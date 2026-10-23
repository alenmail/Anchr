import { Data, Effect, Schema } from "effect";
import {
  type BloxBotProgramManifest,
  BloxBotProgramManifestSchema,
} from "@/lib/bloxbotProgramManifest";
import { type ExplorerSnapshot, ExplorerSnapshotSchema } from "@/lib/explorer";
import {
  type AppConfig,
  AppConfigPatchSchema,
  AppConfigSchema,
  DEFAULT_APP_CONFIG,
  type DesktopApi,
  type InstructionFile,
  InstructionFileSchema,
  type OpenCodeInfo,
  OpenCodeInfoSchema,
  type OpenCodeStartupProgress,
  type StudioMcpStatus,
  StudioMcpStatusSchema,
  type UpdateInfo,
  UpdateInfoSchema,
} from "@/types/desktop";
import {
  type GeneratedProgramArtifact,
  GeneratedProgramArtifactSchema,
} from "@/types/generatedProgram";
import {
  type StudioTargetDiscovery,
  StudioTargetDiscoverySchema,
  type StudioTargetProgramEnvelopes,
  type StudioTargetPrograms,
  StudioTargetProgramsSchema,
  type StudioTargetSelection,
  StudioTargetSelectionSchema,
} from "@/types/studioTarget";

const CONFIG_KEY = "bloxbot-config";
const DEFAULT_CONFIG: AppConfig = DEFAULT_APP_CONFIG;

export class DesktopError extends Data.TaggedError("DesktopError")<{
  message: string;
  cause?: unknown;
}> {}

interface DesktopEffects {
  readonly compileExplorerProgram: DesktopApi["compileExplorerProgram"] extends (
    input: infer Input,
  ) => Promise<infer Output>
    ? (input: Input) => Effect.Effect<Output, DesktopError>
    : never;
  readonly invokeExplorerProgram: (
    artifact: GeneratedProgramArtifact,
    studioId: string,
  ) => Effect.Effect<ExplorerSnapshot, DesktopError>;
  readonly listExplorerProgramTools: Effect.Effect<readonly string[], DesktopError>;
  readonly getOpenCodeInfo: Effect.Effect<OpenCodeInfo, DesktopError>;
  readonly getOpenCodeInstallFolder: Effect.Effect<string | null, DesktopError>;
  readonly getStudioMcpStatus: Effect.Effect<StudioMcpStatus, DesktopError>;
  readonly getVersion: Effect.Effect<string, DesktopError>;
  readonly getInstructionFiles: Effect.Effect<readonly InstructionFile[], DesktopError>;
  readonly openUrl: (url: string) => Effect.Effect<void, DesktopError>;
  readonly loadConfig: Effect.Effect<AppConfig, DesktopError>;
  readonly patchConfig: (patch: Partial<AppConfig>) => Effect.Effect<void, DesktopError>;
  readonly getPinnedState: Effect.Effect<boolean, DesktopError>;
  readonly setPinnedState: (pinned: boolean) => Effect.Effect<boolean, DesktopError>;
  readonly discoverCompatibleModels: (url: string, key: string) => Effect.Effect<Array<{id: string; name: string}>, DesktopError>;
  readonly blenderStatus: Effect.Effect<Awaited<ReturnType<DesktopApi["blenderStatus"]>>, DesktopError>;
  readonly blenderCreateModel: (plan: Parameters<DesktopApi["blenderCreateModel"]>[0]) => Effect.Effect<Awaited<ReturnType<DesktopApi["blenderCreateModel"]>>, DesktopError>;
  readonly openCreativeFile: (path: string) => Effect.Effect<void, DesktopError>;
  readonly openIconFolder: Effect.Effect<void, DesktopError>;
  readonly figmaConfigured: Effect.Effect<boolean, DesktopError>;
  readonly setFigmaToken: (token: string) => Effect.Effect<boolean, DesktopError>;
  readonly figmaFrames: (url: string) => Effect.Effect<Awaited<ReturnType<DesktopApi["figmaFrames"]>>, DesktopError>;
  readonly figmaGenerateUi: (url: string, id: string) => Effect.Effect<Awaited<ReturnType<DesktopApi["figmaGenerateUi"]>>, DesktopError>;
  readonly figmaApplyUi: (source: string) => Effect.Effect<unknown, DesktopError>;
  readonly visionConfigured: Effect.Effect<boolean, DesktopError>;
  readonly listVisionModels: Effect.Effect<Array<{ id: string; label: string }>, DesktopError>;
  readonly getVisionModel: Effect.Effect<string, DesktopError>;
  readonly setVisionModel: (id: string) => Effect.Effect<string, DesktopError>;
  readonly setVisionApiKey: (key: string) => Effect.Effect<boolean, DesktopError>;
  readonly describeImages: (images: {mime:string;dataUrl:string}[], context:string) => Effect.Effect<string, DesktopError>;
  readonly captureScreen: Effect.Effect<{mime:string;dataUrl:string},DesktopError>;
  readonly findVisualReferences: (query:string) => Effect.Effect<Array<{title:string;url:string;imageUrl?:string;description?:string}>,DesktopError>;
  readonly checkForUpdate: Effect.Effect<UpdateInfo | null, DesktopError>;
  readonly installUpdate: Effect.Effect<void, DesktopError>;
  readonly relaunch: Effect.Effect<void, DesktopError>;
  readonly installStudioTargetPrograms: (
    envelopes: StudioTargetProgramEnvelopes,
  ) => Effect.Effect<StudioTargetPrograms, DesktopError>;
  readonly discoverStudioTargets: (
    programs: StudioTargetPrograms,
  ) => Effect.Effect<StudioTargetDiscovery, DesktopError>;
  readonly selectStudioTarget: (
    programs: StudioTargetPrograms,
    targetKey: string,
  ) => Effect.Effect<StudioTargetSelection, DesktopError>;
  readonly getBloxBotPrograms: Effect.Effect<BloxBotProgramManifest | null, DesktopError>;
}

type StartupProgressListener = (progress: OpenCodeStartupProgress) => void;

const loadBrowserConfig = Effect.gen(function* () {
  const stored = yield* Effect.try({
    try: () => {
      const contents = window.localStorage.getItem(CONFIG_KEY);
      return contents ? (JSON.parse(contents) as unknown) : DEFAULT_CONFIG;
    },
    catch: (cause) => new DesktopError({ message: "Failed to load browser configuration", cause }),
  });
  const candidate =
    stored !== null && typeof stored === "object"
      ? { ...DEFAULT_CONFIG, ...stored }
      : DEFAULT_CONFIG;
  return yield* Schema.decodeUnknown(AppConfigSchema)(candidate).pipe(
    Effect.mapError(
      (cause) => new DesktopError({ message: "Browser configuration is invalid", cause }),
    ),
  );
}).pipe(Effect.catchAll(() => Effect.succeed(DEFAULT_CONFIG)));

const browserEffects: DesktopEffects = {
  compileExplorerProgram: () =>
    Effect.fail(new DesktopError({ message: "Explorer requires the desktop app." })),
  getOpenCodeInfo: Effect.fail(
    new DesktopError({
      message: "The desktop service is unavailable. Start BloxBot with pnpm dev.",
    }),
  ),
  getOpenCodeInstallFolder: Effect.succeed(null),
  getStudioMcpStatus: Effect.succeed({ state: "starting" }),
  getPinnedState: Effect.succeed(false),
  setPinnedState: (_pinned) => Effect.succeed(false),
  discoverCompatibleModels: (_url, _key) => Effect.fail(new DesktopError({message: "Model discovery requires the desktop app."})),
  getVersion: Effect.succeed("0.5.2"),
  getInstructionFiles: Effect.succeed([]),
  openUrl: (url) =>
    Effect.sync(() => window.open(url, "_blank", "noopener,noreferrer")).pipe(Effect.asVoid),
  loadConfig: loadBrowserConfig,
  patchConfig: (input) =>
    Effect.gen(function* () {
      const patch = yield* Schema.decodeUnknown(AppConfigPatchSchema)(input).pipe(
        Effect.mapError(
          (cause) => new DesktopError({ message: "Browser configuration patch is invalid", cause }),
        ),
      );
      const current = yield* loadBrowserConfig;
      yield* Effect.try({
        try: () =>
          window.localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...current, ...patch })),
        catch: (cause) =>
          new DesktopError({ message: "Failed to save browser configuration", cause }),
      });
    }),
  blenderStatus: Effect.succeed({available:false,runtimeBundled:false,engine:"Blender (desktop only)",outputDirectory:""}),
  blenderCreateModel: (_plan) => Effect.fail(new DesktopError({message:"Local Blender requires the desktop app."})),
  openCreativeFile: (_path) => Effect.fail(new DesktopError({message:"Requires desktop."})),
  openIconFolder: Effect.fail(new DesktopError({message:"Requires desktop."})),
  figmaConfigured: Effect.succeed(false),
  setFigmaToken: (_token) => Effect.fail(new DesktopError({message:"Figma requires desktop."})),
  figmaFrames: (_url) => Effect.fail(new DesktopError({message:"Figma requires desktop."})),
  figmaGenerateUi: (_url, _id) => Effect.fail(new DesktopError({message:"Figma requires desktop."})),
  figmaApplyUi: (_source) => Effect.fail(new DesktopError({message:"Studio requires desktop."})),
  visionConfigured: Effect.succeed(false),
  listVisionModels: Effect.fail(new DesktopError({ message: "Model discovery requires the Anchr desktop app." })),
  getVisionModel: Effect.succeed("gemini-3.5-flash-lite"),
  setVisionModel: (_id) => Effect.fail(new DesktopError({ message: "Model selection requires the Anchr desktop app." })),
  setVisionApiKey: (_key) => Effect.fail(new DesktopError({message:"Vision setup requires the Anchr desktop app."})),
  describeImages: (_images, _context) => Effect.fail(new DesktopError({message:"Vision requires the Anchr desktop app."})),
  captureScreen: Effect.fail(new DesktopError({message:"Screen capture requires the desktop app."})),
  findVisualReferences: (_query) => Effect.fail(new DesktopError({message:"Web references require the Anchr desktop app."})),
  checkForUpdate: Effect.succeed(null),
  installUpdate: Effect.fail(
    new DesktopError({ message: "Updates are only available in the desktop app." }),
  ),
  invokeExplorerProgram: () =>
    Effect.fail(new DesktopError({ message: "Explorer requires the desktop app." })),
  listExplorerProgramTools: Effect.fail(
    new DesktopError({ message: "Explorer requires the desktop app." }),
  ),
  relaunch: Effect.sync(() => window.location.reload()),
  installStudioTargetPrograms: () =>
    Effect.fail(
      new DesktopError({ message: "Studio targets are only available in the desktop app." }),
    ),
  discoverStudioTargets: () =>
    Effect.fail(
      new DesktopError({ message: "Studio targets are only available in the desktop app." }),
    ),
  selectStudioTarget: () =>
    Effect.fail(
      new DesktopError({ message: "Studio targets are only available in the desktop app." }),
    ),
  getBloxBotPrograms: Effect.succeed(null),
};

const invoke = <A>(message: string, operation: () => Promise<A>) =>
  Effect.tryPromise({
    try: operation,
    catch: (cause) =>
      new DesktopError({
        message: cause instanceof Error ? `${message}: ${cause.message}` : message,
        cause,
      }),
  });

const decodeBridgeValue =
  <A, I>(message: string, schema: Schema.Schema<A, I>) =>
  <E>(effect: Effect.Effect<unknown, E>) =>
    effect.pipe(
      Effect.flatMap(Schema.decodeUnknown(schema)),
      Effect.mapError((cause) =>
        cause instanceof DesktopError ? cause : new DesktopError({ message, cause }),
      ),
    );

function makeBridgeEffects(api: DesktopApi): DesktopEffects {
  return {
    compileExplorerProgram: (program) =>
      invoke("Failed to compile Explorer program", () => api.compileExplorerProgram(program)).pipe(
        decodeBridgeValue("Explorer program artifact is invalid", GeneratedProgramArtifactSchema),
      ),
    getOpenCodeInfo: invoke("Failed to get OpenCode connection details", () =>
      api.getOpenCodeInfo(),
    ).pipe(decodeBridgeValue("OpenCode connection details are invalid", OpenCodeInfoSchema)),
    getOpenCodeInstallFolder: invoke("Failed to get the OpenCode folder", () =>
      api.getOpenCodeInstallFolder(),
    ).pipe(decodeBridgeValue("OpenCode folder is invalid", Schema.NullOr(Schema.String))),
    getPinnedState: invoke("Failed to read pin state", () => api.getPinnedState()),
    setPinnedState: (pinned) => invoke("Failed to pin window", () => api.setPinnedState(pinned)),
    discoverCompatibleModels: (url, key) => invoke("Failed to load models", () => api.discoverCompatibleModels(url, key)),
    getStudioMcpStatus: invoke("Failed to get the Studio MCP status", () =>
      api.getStudioMcpStatus(),
    ).pipe(decodeBridgeValue("Studio MCP status is invalid", StudioMcpStatusSchema)),
    getVersion: invoke("Failed to get the app version", () => api.getVersion()).pipe(
      decodeBridgeValue("Desktop app version is invalid", Schema.String),
    ),
    getInstructionFiles: invoke("Failed to read instruction files", () =>
      api.getInstructionFiles(),
    ).pipe(decodeBridgeValue("Instruction files are invalid", Schema.Array(InstructionFileSchema))),
    openUrl: (url) => invoke("Failed to open the URL", () => api.openUrl(url)),
    loadConfig: invoke("Failed to load configuration", () => api.loadConfig()).pipe(
      decodeBridgeValue("Desktop configuration is invalid", AppConfigSchema),
    ),
    patchConfig: (patch) => invoke("Failed to save configuration", () => api.patchConfig(patch)),
    blenderStatus: invoke("Failed to check Blender runtime", () => api.blenderStatus()),
    blenderCreateModel: (plan) => invoke("Failed to generate Blender model", () => api.blenderCreateModel(plan)),
    openCreativeFile: (path) => invoke("Failed to open creative file", () => api.openCreativeFile(path)),
    openIconFolder: invoke("Failed to open bundled icons", () => api.openIconFolder()),
    figmaConfigured: invoke("Failed to read Figma connection", () => api.figmaConfigured()),
    setFigmaToken: (token) => invoke("Failed to save Figma token", () => api.setFigmaToken(token)),
    figmaFrames: (url) => invoke("Failed to load Figma frames", () => api.figmaFrames(url)),
    figmaGenerateUi: (url, id) => invoke("Failed to import Figma frame", () => api.figmaGenerateUi(url, id)),
    figmaApplyUi: (source) => invoke("Failed to apply UI to Studio", () => api.figmaApplyUi(source)),
    visionConfigured: invoke("Failed to read vision settings", () => api.visionConfigured()),
    listVisionModels: invoke("Failed to load Gemini vision models", () => api.listVisionModels()),
    getVisionModel: invoke("Failed to read selected vision model", () => api.getVisionModel()),
    setVisionModel: (id) => invoke("Failed to select Gemini vision model", () => api.setVisionModel(id)),
    setVisionApiKey: (key) => invoke("Failed to save vision key", () => api.setVisionApiKey(key)),
    describeImages: (images, context) => invoke("Image analysis failed", () => api.describeImages(images,context)),
    captureScreen: invoke("Screenshot failed", () => api.captureScreen()),
    findVisualReferences: (query) => invoke("Web reference search failed", () => api.findVisualReferences(query)),
    checkForUpdate: invoke("Failed to check for updates", () => api.checkForUpdate()).pipe(
      decodeBridgeValue("Update information is invalid", Schema.NullOr(UpdateInfoSchema)),
    ),
    installUpdate: invoke("Failed to install the update", () => api.installUpdate()),
    invokeExplorerProgram: (artifact, studioId) =>
      invoke("Failed to invoke Explorer program", () =>
        api.invokeExplorerProgram(artifact, studioId),
      ).pipe(decodeBridgeValue("Explorer snapshot is invalid", ExplorerSnapshotSchema)),
    listExplorerProgramTools: invoke("Failed to list Explorer program tools", () =>
      api.listExplorerProgramTools(),
    ).pipe(decodeBridgeValue("Explorer program tools are invalid", Schema.Array(Schema.String))),
    relaunch: invoke("Failed to relaunch the app", () => api.relaunch()),
    installStudioTargetPrograms: (envelopes) =>
      invoke("Failed to install Studio target programs", () =>
        api.installStudioTargetPrograms(envelopes),
      ).pipe(decodeBridgeValue("Studio target programs are invalid", StudioTargetProgramsSchema)),
    discoverStudioTargets: (programs) =>
      invoke("Failed to discover Studio targets", () => api.discoverStudioTargets(programs)).pipe(
        decodeBridgeValue("Studio target discovery is invalid", StudioTargetDiscoverySchema),
      ),
    selectStudioTarget: (programs, targetKey) =>
      invoke("Failed to select the Studio target", () =>
        api.selectStudioTarget(programs, targetKey),
      ).pipe(decodeBridgeValue("Studio target selection is invalid", StudioTargetSelectionSchema)),
    getBloxBotPrograms: invoke("Failed to read published BloxBot programs", () =>
      api.getBloxBotPrograms(),
    ).pipe(
      decodeBridgeValue(
        "Published BloxBot programs are invalid",
        Schema.NullOr(BloxBotProgramManifestSchema),
      ),
    ),
  };
}

export const desktopEffects: DesktopEffects = window.bloxbot
  ? makeBridgeEffects(window.bloxbot)
  : browserEffects;

const runPromise = <A>(effect: Effect.Effect<A, DesktopError>): Promise<A> =>
  Effect.runPromise(effect);

/** Promise-only adapter consumed by React and exposed by the Electron bridge contract. */
export const desktop: DesktopApi = {
  compileExplorerProgram: (program) => runPromise(desktopEffects.compileExplorerProgram(program)),
  getOpenCodeInfo: () => runPromise(desktopEffects.getOpenCodeInfo),
  getOpenCodeInstallFolder: () => runPromise(desktopEffects.getOpenCodeInstallFolder),
  getStudioMcpStatus: () => runPromise(desktopEffects.getStudioMcpStatus),
  getPinnedState: () => runPromise(desktopEffects.getPinnedState),
  setPinnedState: (pinned) => runPromise(desktopEffects.setPinnedState(pinned)),
  discoverCompatibleModels: (url, key) => runPromise(desktopEffects.discoverCompatibleModels(url, key)),
  onOpenCodeStartupProgress: (listener: StartupProgressListener) =>
    window.bloxbot?.onOpenCodeStartupProgress(listener) ?? (() => {}),
  getVersion: () => runPromise(desktopEffects.getVersion),
  getInstructionFiles: () => runPromise(desktopEffects.getInstructionFiles),
  openUrl: (url) => runPromise(desktopEffects.openUrl(url)),
  loadConfig: () => runPromise(desktopEffects.loadConfig),
  patchConfig: (patch) => runPromise(desktopEffects.patchConfig(patch)),
  blenderStatus: () => runPromise(desktopEffects.blenderStatus),
  blenderCreateModel: (plan) => runPromise(desktopEffects.blenderCreateModel(plan)),
  openCreativeFile: (path) => runPromise(desktopEffects.openCreativeFile(path)),
  openIconFolder: () => runPromise(desktopEffects.openIconFolder),
  figmaConfigured: () => runPromise(desktopEffects.figmaConfigured),
  setFigmaToken: (token) => runPromise(desktopEffects.setFigmaToken(token)),
  figmaFrames: (url) => runPromise(desktopEffects.figmaFrames(url)),
  figmaGenerateUi: (url, id) => runPromise(desktopEffects.figmaGenerateUi(url, id)),
  figmaApplyUi: (source) => runPromise(desktopEffects.figmaApplyUi(source)),
  visionConfigured: () => runPromise(desktopEffects.visionConfigured),
  listVisionModels: () => runPromise(desktopEffects.listVisionModels),
  getVisionModel: () => runPromise(desktopEffects.getVisionModel),
  setVisionModel: (id) => runPromise(desktopEffects.setVisionModel(id)),
  setVisionApiKey: (key) => runPromise(desktopEffects.setVisionApiKey(key)),
  describeImages: (images, context) => runPromise(desktopEffects.describeImages(images, context)),
  captureScreen: () => runPromise(desktopEffects.captureScreen),
  findVisualReferences: (query) => runPromise(desktopEffects.findVisualReferences(query)),
  checkForUpdate: () => runPromise(desktopEffects.checkForUpdate),
  installUpdate: () => runPromise(desktopEffects.installUpdate),
  invokeExplorerProgram: (artifact, studioId) =>
    runPromise(desktopEffects.invokeExplorerProgram(artifact, studioId)),
  listExplorerProgramTools: () => runPromise(desktopEffects.listExplorerProgramTools),
  relaunch: () => runPromise(desktopEffects.relaunch),
  installStudioTargetPrograms: (envelopes) =>
    runPromise(desktopEffects.installStudioTargetPrograms(envelopes)),
  discoverStudioTargets: (programs) => runPromise(desktopEffects.discoverStudioTargets(programs)),
  selectStudioTarget: (programs, targetKey) =>
    runPromise(desktopEffects.selectStudioTarget(programs, targetKey)),
  getBloxBotPrograms: () => runPromise(desktopEffects.getBloxBotPrograms),
  onBloxBotProgramsUpdated: (listener) =>
    window.bloxbot?.onBloxBotProgramsUpdated(listener) ?? (() => {}),
  onMainError: (listener) => window.bloxbot?.onMainError(listener) ?? (() => {}),
};
