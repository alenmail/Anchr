import { rename, readFile, rm, writeFile } from "node:fs/promises";
import { userInfo } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";
import { autoUpdater } from "electron-updater";
import { Cause, Data, Effect, Layer, ManagedRuntime, Schema } from "effect";

import {
  type AppConfig,
  AppConfigPatchSchema,
  AppConfigSchema,
  DEFAULT_APP_CONFIG,
  type OpenCodeStartupProgress,
} from "../src/types/desktop";
import { ExplorerProgramEnvelopeSchema, ExplorerSnapshotSchema } from "../src/lib/explorer";
import { GeneratedProgramArtifactSchema } from "../src/types/generatedProgram";
import {
  StudioTargetDiscoverySchema,
  StudioTargetProgramEnvelopesSchema,
  StudioTargetProgramsSchema,
  StudioTargetSelectionSchema,
} from "../src/types/studioTarget";
import { handleLastWindowClosed } from "./appLifecycle";
import { createMainErrorReporter } from "./errorReporter";
import { findInstructionFiles } from "./instructionFiles";
import { channels } from "./channels";
import { anchrCompatibleProvider } from "./opencodeConfig";
import { captureStudioScreen, describeImages, findVisualReferences, saveVisionKey, visionIsConfigured, listVisionModels, getVisionModel, setVisionModel } from "./assistantServices";
import { getBlenderStatus, createBlenderModel, openCreativeFile, openIconFolder, type BlenderPlan } from "./creativeServices";
import { figmaConfigured, setFigmaToken, listFigmaFrames, generateFigmaUi } from "./figmaConnector";
import { makeOpenCodeLayer, OpenCode } from "./services/OpenCode";
import {
  GeneratedProgramRuntime,
  GeneratedProgramRuntimeLive,
} from "./services/GeneratedProgramRuntime";
import { createBloxBotProgramStore } from "./services/BloxBotProgramStore";
import { makeStudioMcpBrokerLayer, StudioMcpBroker } from "./services/StudioMcpBroker";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const defaultConfig: AppConfig = DEFAULT_APP_CONFIG;
const configMutex = Effect.unsafeMakeSemaphore(1);

function configPath(): string {
  return join(app.getPath("userData"), "anchr-store.json");
}

let mainWindow: BrowserWindow | null = null;
let quitting = false;

function currentUsername(): string | undefined {
  try {
    return userInfo().username;
  } catch {
    return undefined;
  }
}

const mainErrorReporter = createMainErrorReporter({
  channel: channels.mainError,
  home: app.getPath("home"),
  username: currentUsername(),
});

/** Sends a main-process error to the renderer, which reports it if analytics is on. */
function reportMainError(source: string, error: unknown): void {
  mainErrorReporter.report(source, error);
}

// A monitor observes without replacing Electron's own uncaught-exception handling.
process.on("uncaughtExceptionMonitor", (error) => reportMainError("main_uncaught_exception", error));
// Electron only warns about unhandled rejections; keep that log line and report it.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection in the main process:", reason);
  reportMainError("main_unhandled_rejection", reason);
});

const reportLayerFailure = (source: string) => (cause: Cause.Cause<unknown>) =>
  Effect.sync(() => {
    if (!Cause.isInterruptedOnly(cause)) reportMainError(source, Cause.squash(cause));
  });

class DesktopMainError extends Data.TaggedError("DesktopMainError")<{
  message: string;
  cause?: unknown;
}> {}

const studioMcpBrokerLayer = makeStudioMcpBrokerLayer({
  workspace: join(app.getPath("home"), "Anchr"),
  localAppData: process.env.LOCALAPPDATA,
  comSpec: process.env.ComSpec,
  systemRoot: process.env.SystemRoot,
  // Reported once per launch, after the startup retries, and not when Studio isn't installed.
  onStartFailure: (error) => reportMainError("studio_mcp_broker_start", error),
}).pipe(Layer.tapErrorCause(reportLayerFailure("studio_mcp_broker_start")));

const openCodeBinaryDirectory = join(app.getPath("userData"), "opencode");

const openCodeRuntime = ManagedRuntime.make(
  Layer.merge(
    makeOpenCodeLayer({
      binaryCacheDirectory: openCodeBinaryDirectory,
      userConfigPath: configPath(),
      workspace: join(app.getPath("home"), "Anchr"),
      onStartupProgress: (progress: OpenCodeStartupProgress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(channels.openCodeStartupProgress, progress);
        }
      },
    }).pipe(Layer.tapErrorCause(reportLayerFailure("opencode_start"))),
    GeneratedProgramRuntimeLive.pipe(Layer.provide(studioMcpBrokerLayer)),
  ).pipe(Layer.provideMerge(studioMcpBrokerLayer)),
);

// Published BloxBot programs: downloaded, signature-checked and cached here so a
// Roblox Studio MCP change can be fixed without an app release.
const BLOXBOT_PROGRAMS_REFRESH_MS = 6 * 60 * 60 * 1000;
const bloxbotProgramStore = createBloxBotProgramStore({
  directory: join(app.getPath("userData"), "anchr-programs"),
  fetch: async () => new Response(null, { status: 404 }),
  log: (message) => console.log(message),
  onError: (error) => reportMainError("bloxbot_programs_refresh", error),
});

const expectedContract = (name: string) => ({
  name,
  version: "1",
  inputSchemaVersion: "1",
  outputSchemaVersion: "1",
});

function requireContract(contract: { name: string; version: string; inputSchemaVersion: string; outputSchemaVersion: string }, name: string) {
  const expected = expectedContract(name);
  if (JSON.stringify(contract) !== JSON.stringify(expected)) {
    return Effect.fail(new DesktopMainError({ message: `Generated program contract ${name} is invalid` }));
  }
  return Effect.void;
}

function isMissingFile(cause: unknown): boolean {
  return (
    cause !== null &&
    typeof cause === "object" &&
    "code" in cause &&
    cause.code === "ENOENT"
  );
}

function parseExternalUrl(rawUrl: string) {
  return Effect.try({
    try: () => new URL(rawUrl),
    catch: (cause) =>
      new DesktopMainError({ message: "Only HTTP and HTTPS links can be opened", cause }),
  }).pipe(
    Effect.flatMap((url) =>
      url.protocol === "https:" || url.protocol === "http:"
        ? Effect.succeed(url)
        : Effect.fail(
            new DesktopMainError({ message: "Only HTTP and HTTPS links can be opened" }),
          ),
    ),
  );
}

const loadConfig = Effect.gen(function* () {
  const contents = yield* Effect.tryPromise({
    try: () => readFile(configPath(), "utf8"),
    catch: (cause) => new DesktopMainError({ message: "Failed to read app configuration", cause }),
  }).pipe(
    Effect.catchAll((error) =>
      isMissingFile(error.cause) ? Effect.succeed(null) : Effect.fail(error),
    ),
  );
  if (contents === null) return defaultConfig;

  return yield* Effect.gen(function* () {
    const stored = yield* Effect.try({
      try: () => JSON.parse(contents) as unknown,
      catch: (cause) => new DesktopMainError({ message: "App configuration is invalid", cause }),
    });
    const candidate =
      stored !== null && typeof stored === "object" ? { ...defaultConfig, ...stored } : defaultConfig;
    return yield* Schema.decodeUnknown(AppConfigSchema)(candidate).pipe(
      Effect.mapError(
        (cause) => new DesktopMainError({ message: "App configuration is invalid", cause }),
      ),
    );
  }).pipe(
    Effect.tapError((error) => Effect.logWarning(error.message, error.cause)),
    Effect.catchAll(() => Effect.succeed(defaultConfig)),
  );
});

function patchConfig(input: unknown) {
  return Effect.gen(function* () {
    const patch = yield* Schema.decodeUnknown(AppConfigPatchSchema)(input).pipe(
      Effect.mapError(
        (cause) => new DesktopMainError({ message: "App configuration patch is invalid", cause }),
      ),
    );
    const current = yield* loadConfig;
    const next = { ...current, ...patch };
    yield* Effect.tryPromise({
      try: async () => {
        const destination = configPath();
        const temporary = `${destination}.${process.pid}.tmp`;
        try {
          await writeFile(temporary, JSON.stringify(next, null, 2), { mode: 0o600 });
          await rename(temporary, destination);
          if (Object.hasOwn(patch, "pinnedToScreen") && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setAlwaysOnTop(next.pinnedToScreen, "floating");
          }
          // Keep the running OpenCode instance's provider catalog in sync with Settings.
          // Credentials remain in OpenCode's auth store and are never written to Anchr settings.
          if (Object.hasOwn(patch, "customEndpoint")) {
            const path = join(app.getPath("home"), "Anchr", ".opencode", "config", "opencode", "opencode.json");
            try {
              const data = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
              const providers = (data.provider ?? {}) as Record<string, unknown>;
              if (next.customEndpoint) providers["anchr-compatible"] = anchrCompatibleProvider(next.customEndpoint);
              else delete providers["anchr-compatible"];
              data.provider = providers;
              await writeFile(path + ".tmp", JSON.stringify(data, null, 2));
              await rename(path + ".tmp", path);
            } catch (error) {
              console.warn("[Anchr] Provider settings saved; the AI engine may need a restart", error);
            }
          }
        } catch (cause) {
          await rm(temporary, { force: true }).catch(() => undefined);
          throw cause;
        }
      },
      catch: (cause) =>
        new DesktopMainError({ message: "Failed to write app configuration", cause }),
    });
  }).pipe(configMutex.withPermits(1));
}

const runMain = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);

const registerIpcHandlers = Effect.sync(() => {
  ipcMain.on(channels.mainErrorReady, (event) => mainErrorReporter.attach(event.sender));
  ipcMain.handle(channels.compileExplorerProgram, (_event, input: unknown) =>
    openCodeRuntime.runPromise(
      Effect.gen(function* () {
        const program = yield* Schema.decodeUnknown(ExplorerProgramEnvelopeSchema)(input);
        const runtime = yield* GeneratedProgramRuntime;
        return yield* runtime.compile(program);
      }),
    ),
  );
  ipcMain.handle(channels.listExplorerProgramTools, () =>
    openCodeRuntime.runPromise(
      GeneratedProgramRuntime.pipe(
        Effect.flatMap((runtime) => runtime.allowedTools("explorer-snapshot")),
      ),
    ),
  );
  ipcMain.handle(channels.getOpenCodeInfo, () =>
    openCodeRuntime.runPromise(
      OpenCode.pipe(Effect.flatMap((service) => service.info)),
    ),
  );
  ipcMain.handle(channels.getOpenCodeInstallFolder, () => openCodeBinaryDirectory);
  ipcMain.handle(channels.getStudioMcpStatus, () =>
    openCodeRuntime.runPromise(StudioMcpBroker.pipe(Effect.flatMap((broker) => broker.status))),
  );
  ipcMain.handle(channels.getVersion, () => runMain(Effect.sync(() => app.getVersion())));
  ipcMain.handle(channels.getInstructionFiles, () =>
    findInstructionFiles({
      workspace: join(app.getPath("home"), "Anchr"),
      // OpenCode runs with XDG_CONFIG_HOME inside the workspace (see services/OpenCode.ts).
      globalConfigDirectory: join(app.getPath("home"), "Anchr", ".opencode", "config", "opencode"),
      home: app.getPath("home"),
    }),
  );
  ipcMain.handle(channels.getBloxBotPrograms, () => bloxbotProgramStore.current());
  ipcMain.handle(channels.loadConfig, () => runMain(loadConfig));
  ipcMain.handle(channels.patchConfig, (_event, patch: unknown) => runMain(patchConfig(patch)));
  ipcMain.handle(channels.getPinnedState, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return Boolean(win?.isAlwaysOnTop());
  });
  ipcMain.handle(channels.setPinnedState, async (event, pinned: unknown) => {
    if (typeof pinned !== "boolean") throw new Error("Invalid pin state");
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) throw new Error("Anchr window is unavailable");
    win.setAlwaysOnTop(pinned, "floating");
    const applied = win.isAlwaysOnTop();
    if (applied !== pinned) throw new Error("Windows did not accept the always-on-top setting");
    await runMain(patchConfig({ pinnedToScreen: applied }));
    return applied;
  });
  ipcMain.handle(channels.blenderStatus, () => getBlenderStatus());
  ipcMain.handle(channels.blenderCreateModel, (_event, plan: BlenderPlan) => createBlenderModel(plan));
  ipcMain.handle(channels.openCreativeFile, (_event, path: string) => openCreativeFile(path));
  ipcMain.handle(channels.openIconFolder, () => openIconFolder());
  ipcMain.handle(channels.figmaConfigured, () => figmaConfigured());
  ipcMain.handle(channels.setFigmaToken, (_event, token: unknown) => {
    if (typeof token !== "string") throw new Error("Invalid Figma token");
    return setFigmaToken(token);
  });
  ipcMain.handle(channels.figmaFrames, (_event, url: unknown) => {
    if (typeof url !== "string") throw new Error("Invalid Figma file URL");
    return listFigmaFrames(url);
  });
  ipcMain.handle(channels.figmaGenerateUi, (_event, url: unknown, id: unknown) => {
    if (typeof url !== "string" || typeof id !== "string") throw new Error("Invalid Figma frame");
    return generateFigmaUi(url, id);
  });
  ipcMain.handle(channels.figmaApplyUi, (_event, source: unknown) => {
    if (typeof source !== "string" || source.length > 150_000 ||
        !source.startsWith("-- Generated by Anchr.")) throw new Error("Only generated, reviewed Anchr UI scripts may be applied");
    return openCodeRuntime.runPromise(
      StudioMcpBroker.pipe(Effect.flatMap(broker => broker.callTool("execute_luau", { code: source }))),
    );
  });
  ipcMain.handle(channels.visionConfigured, () => visionIsConfigured());
  ipcMain.handle(channels.listVisionModels, () => listVisionModels());
  ipcMain.handle(channels.getVisionModel, () => getVisionModel());
  ipcMain.handle(channels.setVisionModel, (_event, id: unknown) => {
    if (typeof id !== "string") throw new Error("Invalid vision model ID");
    return setVisionModel(id);
  });
  ipcMain.handle(channels.setVisionApiKey, (_event, key: unknown) => {
    if (typeof key !== "string") throw new Error("Invalid vision API key");
    return saveVisionKey(key);
  });
  ipcMain.handle(channels.describeImages, (_event, images: unknown, context: unknown) => {
    if (!Array.isArray(images) || typeof context !== "string") throw new Error("Invalid image description");
    return describeImages(images, context);
  });
  ipcMain.handle(channels.captureScreen, () => captureStudioScreen());
  ipcMain.handle(channels.findVisualReferences, (_event, query: unknown) => {
    if (typeof query !== "string") throw new Error("Invalid reference query");
    return findVisualReferences(query);
  });
  ipcMain.handle(channels.discoverCompatibleModels, async (_event, baseURL: unknown, apiKey: unknown) => {
    if (typeof baseURL !== "string" || baseURL.length > 2048 || typeof apiKey !== "string" || apiKey.length > 8192)
      throw new Error("Invalid endpoint details");
    const parsed = new URL(baseURL.trim());
    const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (parsed.username || parsed.password || (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLoopback)))
      throw new Error("Use HTTPS, or HTTP on localhost for a local model server");
    const endpoint = new URL(parsed.toString().replace(/\/+$/, "") + "/models");
    const response = await fetch(endpoint, {
      headers: { "Accept": "application/json", ...(apiKey.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : {}) },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`Model discovery returned HTTP ${response.status}. Verify the URL and API key.`);
    const length = Number(response.headers.get("content-length") || "0");
    if (length > 1024 * 1024) throw new Error("Model list is too large");
    const body = await response.text();
    if (body.length > 1024 * 1024) throw new Error("Model list is too large");
    const payload = JSON.parse(body) as { data?: unknown };
    if (!Array.isArray(payload.data)) throw new Error("No models found: expected an OpenAI-compatible /models response");
    const names = new Map<string, string>();
    for (const value of payload.data) {
      if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string") continue;
      const id = value.id.trim();
      if (!id || id.length > 256) continue;
      const label = "name" in value && typeof value.name === "string" ? value.name.trim() : id;
      names.set(id, label || id);
    }
    if (!names.size) throw new Error("This endpoint returned no usable models");
    return [...names.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  });
  ipcMain.handle(channels.installStudioTargetPrograms, (_event, input: unknown) =>
    openCodeRuntime.runPromise(
      Effect.gen(function* () {
        const envelopes = yield* Schema.decodeUnknown(StudioTargetProgramEnvelopesSchema)(input);
        yield* requireContract(envelopes.discovery.contract, "studio-target-discovery");
        yield* requireContract(envelopes.selection.contract, "studio-target-selection");
        const runtime = yield* GeneratedProgramRuntime;
        const [discoveryArtifact, selectionArtifact] = yield* Effect.all([
          runtime.compile(envelopes.discovery),
          runtime.compile(envelopes.selection),
        ], { concurrency: "unbounded" });
        return yield* Schema.decodeUnknown(StudioTargetProgramsSchema)({
          discovery: { envelope: envelopes.discovery, artifact: discoveryArtifact },
          selection: { envelope: envelopes.selection, artifact: selectionArtifact },
        });
      }),
    ),
  );
  ipcMain.handle(channels.discoverStudioTargets, (_event, input: unknown) =>
    openCodeRuntime.runPromise(
      Effect.gen(function* () {
        yield* Effect.logInfo("[studio-target] discovery requested");
        const programs = yield* Schema.decodeUnknown(StudioTargetProgramsSchema)(input);
        yield* requireContract(programs.discovery.artifact.contract, "studio-target-discovery");
        const runtime = yield* GeneratedProgramRuntime;
        const result = yield* runtime.invoke({ artifact: programs.discovery.artifact, input: {} });
        const discovery = yield* Schema.decodeUnknown(StudioTargetDiscoverySchema)(result.value);
        yield* Effect.logInfo(
          `[studio-target] discovery completed targets=${discovery.targets.length} selected=${discovery.selectedKey !== null}`,
        );
        return discovery;
      }),
    ),
  );
  ipcMain.handle(channels.selectStudioTarget, (_event, input: unknown, targetKey: unknown) =>
    openCodeRuntime.runPromise(
      Effect.gen(function* () {
        const programs = yield* Schema.decodeUnknown(StudioTargetProgramsSchema)(input);
        const key = yield* Schema.decodeUnknown(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(512)))(targetKey);
        yield* requireContract(programs.selection.artifact.contract, "studio-target-selection");
        const runtime = yield* GeneratedProgramRuntime;
        const result = yield* runtime.invoke({ artifact: programs.selection.artifact, input: { targetKey: key } });
        return yield* Schema.decodeUnknown(StudioTargetSelectionSchema)(result.value);
      }),
    ),
  );
  ipcMain.handle(channels.openUrl, (_event, rawUrl: string) =>
    runMain(
      parseExternalUrl(rawUrl).pipe(
        Effect.flatMap((url) =>
          Effect.tryPromise({
            try: () => shell.openExternal(url.href),
            catch: (cause) => new DesktopMainError({ message: "Failed to open URL", cause }),
          }),
        ),
      ),
    ),
  );
  ipcMain.handle(channels.checkForUpdate, async () => {
    if (!app.isPackaged) return null;
    autoUpdater.allowPrerelease = true;
    autoUpdater.channel = "beta";
    const result = await autoUpdater.checkForUpdates();
    if (!result || result.updateInfo.version === app.getVersion()) return null;
    const notes = result.updateInfo.releaseNotes;
    const body = typeof notes === "string" ? notes : Array.isArray(notes) ?
      notes.map(entry => entry.note ?? "").join("\n") : null;
    return { version: result.updateInfo.version, body };
  });
  ipcMain.handle(channels.installUpdate, async () => {
    if (!app.isPackaged) throw new Error("Updates require an installed release");
    autoUpdater.allowPrerelease = true;
    autoUpdater.channel = "beta";
    const check = await autoUpdater.checkForUpdates();
    if (!check || check.updateInfo.version === app.getVersion()) throw new Error("No newer Anchr version is available");
    await autoUpdater.downloadUpdate();
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
  });
  ipcMain.handle(
    channels.invokeExplorerProgram,
    (_event, input: unknown, studioIdInput: unknown) =>
      openCodeRuntime.runPromise(
        Effect.gen(function* () {
          const artifact = yield* Schema.decodeUnknown(GeneratedProgramArtifactSchema)(input);
          const studioId = yield* Schema.decodeUnknown(
            Schema.String.pipe(Schema.minLength(1), Schema.maxLength(512)),
          )(studioIdInput);
          if (
            artifact.contract.name !== "explorer-snapshot" ||
            artifact.contract.outputSchemaVersion !== "explorer-snapshot-v1"
          ) {
            return yield* Effect.fail(
              new DesktopMainError({ message: "Explorer program contract is invalid" }),
            );
          }
          const runtime = yield* GeneratedProgramRuntime;
          const result = yield* runtime.invoke({ artifact, input: { studioId } });
          return yield* Schema.decodeUnknown(ExplorerSnapshotSchema)(result.value).pipe(
            Effect.mapError(
              (cause) =>
                new DesktopMainError({
                  // The schema's own complaint, so a model-written program can be fixed.
                  message: `Explorer output is invalid: ${cause.message.slice(0, 600)}`,
                  cause,
                }),
            ),
          );
        }).pipe(
          Effect.tapErrorCause((cause) =>
            Effect.logError(`[explorer] invocation failed: ${String(cause)}`),
          ),
        ),
      ),
  );
  ipcMain.handle(channels.relaunch, () =>
    runMain(
      Effect.sync(() => {
        app.relaunch();
        app.quit();
      }),
    ),
  );
});

function createWindow(): Effect.Effect<void, DesktopMainError> {
  return Effect.gen(function* () {
    const config = yield* loadConfig;
    const window = yield* Effect.try({
      try: () =>
        new BrowserWindow({
          title: "Anchr",
          width: 920,
          height: 600,
          minWidth: 520,
          minHeight: 400,
          backgroundColor: "#ffffff",
          titleBarStyle: "hiddenInset",
          show: false,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: join(currentDirectory, "..", "preload", "preload.mjs"),
            sandbox: true,
          },
        }),
      catch: (cause) => new DesktopMainError({ message: "Failed to create app window", cause }),
    });

    yield* Effect.sync(() => {
      mainWindow = window;
      window.setAlwaysOnTop(config.pinnedToScreen, "floating");
      window.webContents.setUserAgent(
        `${window.webContents.getUserAgent()} Anchr/${app.getVersion()}`,
      );
      window.webContents.setWindowOpenHandler(({ url }) => {
        Effect.runFork(
          parseExternalUrl(url).pipe(
            Effect.flatMap((externalUrl) =>
              Effect.tryPromise({
                try: () => shell.openExternal(externalUrl.href),
                catch: (cause) =>
                  new DesktopMainError({ message: "Failed to open URL", cause }),
              }),
            ),
            Effect.catchAll(Effect.logWarning),
          ),
        );
        return { action: "deny" };
      });
      window.webContents.on("will-navigate", (event, url) => {
        const currentUrl = window.webContents.getURL();
        const shouldBlock = Effect.runSync(
          Effect.try({
            try: () => Boolean(currentUrl && new URL(url).origin !== new URL(currentUrl).origin),
            catch: () => true,
          }).pipe(Effect.catchAll(() => Effect.succeed(true))),
        );
        if (shouldBlock) event.preventDefault();
      });
      window.once("ready-to-show", () => Effect.runSync(Effect.sync(() => window.show())));
      window.on("closed", () =>
        Effect.runSync(
          Effect.sync(() => {
            if (mainWindow === window) mainWindow = null;
          }),
        ),
      );
    });

    yield* Effect.tryPromise({
      try: () =>
        process.env.VITE_DEV_SERVER_URL
          ? window.loadURL(process.env.VITE_DEV_SERVER_URL)
          : window.loadFile(join(currentDirectory, "..", "..", "dist", "index.html")),
      catch: (cause) => new DesktopMainError({ message: "Failed to load the app window", cause }),
    });
  });
}

const registerAppLifecycle = Effect.sync(() => {
  app.on("window-all-closed", () =>
    Effect.runSync(
      Effect.sync(() => {
        handleLastWindowClosed(process.platform, {
          hideDock: () => app.dock?.hide(),
          quit: () => app.quit(),
        });
      }),
    ),
  );

  app.on("before-quit", (event) => {
    if (quitting) return;
    event.preventDefault();
    Effect.runFork(
      Effect.tryPromise({
        try: () => openCodeRuntime.dispose(),
        catch: (cause) =>
          new DesktopMainError({ message: "Failed to stop the OpenCode runtime", cause }),
      }).pipe(
        Effect.catchAll(Effect.logError),
        Effect.ensuring(
          Effect.sync(() => {
            quitting = true;
            app.quit();
          }),
        ),
      ),
    );
  });
});

Effect.runFork(
  Effect.gen(function* () {
    yield* Effect.sync(() => {
      autoUpdater.autoDownload = false;
      autoUpdater.autoInstallOnAppQuit = true;
    });
    yield* registerAppLifecycle;
    yield* Effect.tryPromise({
      try: () => app.whenReady(),
      catch: (cause) => new DesktopMainError({ message: "Electron failed to become ready", cause }),
    });
    // The cached copy is ready before the window asks for it; the download
    // happens in the background and applies from the next time a program loads.
    yield* Effect.promise(() => bloxbotProgramStore.load());
    yield* registerIpcHandlers;
    yield* Effect.sync(() => {
      // Tell the window when newer programs arrive, so they apply without a restart.
      const refresh = () =>
        void bloxbotProgramStore.refresh().then((result) => {
          if (result === "updated" && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(channels.bloxbotProgramsUpdated);
          }
        });
      refresh();
      setInterval(refresh, BLOXBOT_PROGRAMS_REFRESH_MS).unref();
    });
    yield* Effect.sync(() => Menu.setApplicationMenu(null));
    yield* createWindow();
    yield* Effect.sync(() =>
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          Effect.runFork(
            createWindow().pipe(
              Effect.tapError((error) =>
                Effect.sync(() => reportMainError("main_create_window", error)),
              ),
              Effect.catchAll(Effect.logError),
            ),
          );
        }
      }),
    );
  }).pipe(
    Effect.tapError((error) => Effect.sync(() => reportMainError("main_startup", error))),
    Effect.catchAll(Effect.logError),
  ),
);
