import { win32, join } from "node:path";

import { STUDIO_MCP_SERVER_NAME } from "../src/lib/bloxbotProgramManifest";
import type { AppConfig } from "../src/types/desktop";

export interface StudioMcpWindowsEnvironment {
  localAppData?: string;
  comSpec?: string;
  systemRoot?: string;
}

export function studioMcpCommand(
  platform: NodeJS.Platform,
  environment: StudioMcpWindowsEnvironment = {},
): string[] {
  if (platform === "darwin") {
    return ["/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP"];
  }

  if (platform === "win32") {
    const dataDirectory = environment.localAppData ?? "C:\\Users\\Default\\AppData\\Local";
    // Resolve cmd.exe absolutely: the MCP stdio transport spawns with a reduced
    // environment, so a PATH without System32 makes a bare "cmd.exe" fail with ENOENT.
    const systemRoot = environment.systemRoot ?? "C:\\Windows";
    const comSpec = environment.comSpec ?? win32.join(systemRoot, "System32", "cmd.exe");
    return [comSpec, "/c", win32.join(dataDirectory, "Roblox", "mcp.bat")];
  }

  return ["studio-mcp"];
}

/**
 * The file Roblox Studio installs for its MCP helper, or null when the command is looked up
 * on PATH. When the file is missing, Studio isn't installed or hasn't set up MCP yet.
 */
export function studioMcpInstallPath(
  platform: NodeJS.Platform,
  environment: StudioMcpWindowsEnvironment = {},
): string | null {
  if (platform === "darwin" || platform === "win32") {
    return studioMcpCommand(platform, environment).at(-1) ?? null;
  }
  return null;
}

export function anchrCompatibleProvider(endpoint: NonNullable<AppConfig["customEndpoint"]>) {
  return {
    npm: "@ai-sdk/openai-compatible",
    name: "OpenAI-compatible",
    options: { baseURL: endpoint.baseURL },
    models: { [endpoint.modelId]: { name: endpoint.modelId, limit: { context: 32768, output: 8192 } } },
  };
}

export function createOpenCodeConfig(broker: { url: string }, endpoint: AppConfig["customEndpoint"] = null, figmaBridge: { url: string; secret: string } | null = null, blenderLive: { enabled: boolean; executable?: string } = {enabled:false}) {
  return {
    // Keep OpenCode's standard automatic context compaction enabled for long sessions.
    compaction: {
      auto: true,
    },
    provider: endpoint ? { "anchr-compatible": anchrCompatibleProvider(endpoint) } : {},
    mcp: {
      ...(figmaBridge ? { "anchr-figma": {
        type: "local" as const,
        command: [process.execPath, join(process.resourcesPath, "anchr-mcp", "node_modules", "anchr-figma-mcp.mjs")],
        environment: {
          ELECTRON_RUN_AS_NODE: "1",
          ANCHR_FIGMA_BRIDGE_URL: figmaBridge.url,
          ANCHR_FIGMA_BRIDGE_TOKEN: figmaBridge.secret,
        },
        timeout: 10000,
        enabled: true,
      }} : {}),
      "anchr-blender": blenderLive.enabled ? {
        type: "local" as const,
        // Optional community Blender MCP. Never auto-installs or runs unless
        // the user explicitly opts in under Creative Tools.
        command: [blenderLive.executable || "uvx", "--python", "3.11", "--from",
          "mcp-for-blender==2.2.2", "mcp-for-blender"],
        environment: { BLENDER_MCP_SAFE_MODE: "1", BLENDER_HOST: "127.0.0.1", BLENDER_PORT: "9876" },
        timeout: 30000,
        enabled: true,
      } : {
        type: "local",
        command: [
          process.execPath,
          join(process.resourcesPath, "anchr-mcp", "node_modules", "anchr-blender-mcp.mjs"),
        ],
        environment: {
          ELECTRON_RUN_AS_NODE: "1",
          ANCHR_BLENDER_PATH: join(process.resourcesPath, "blender-runtime", "blender.exe"),
          ANCHR_BLENDER_BACKEND: join(process.resourcesPath, "anchr-mcp", "node_modules", "anchr-blender-backend.py"),
          ANCHR_CREATIVE_OUTPUT: join(process.env.USERPROFILE || process.cwd(), "Anchr", "Creative", "Models"),
        },
        timeout: 10000,
        enabled: true,
      },
      [STUDIO_MCP_SERVER_NAME]: {
        type: "remote",
        url: broker.url,
        enabled: true,
      },
    },
    default_agent: "studio",
    agent: {
      studio: {
        mode: "primary",
        description: "Anchr Roblox Studio development assistant by Stone",
        // OpenCode loads project AGENTS.md separately; keep this Studio-specific and compact.
        prompt:
          "Use Anchr Studio tools (the Chrrxs MCP server). Start by calling get_connected_instances and use instance_id to scope calls. " +
          "Inspect with get_project_structure, search_objects, and get_instance_properties before editing. Edit scripts with edit_script_lines or set_script_source. " +
          "Playtest and read runtime logs when applicable. The built-in Roblox Studio MCP server is not used. " +
          "When a user provides a Figma file and asks to implement a UI, use figma_get_design_context to inspect its read-only layout and visual hierarchy, then generate Luau and ask for review before inserting it. Complex icons and vectors require uploaded Roblox asset IDs. " +
          "When available, inspect Roblox Creator Store with search_assets and preview_asset for quality, licensed, safe mesh/rig candidates; request approval before insert_asset. " +
          "For bespoke 3D mesh edits and animation prefer the connected Blender MCP tools when available, inspect the actual scene and viewport, then iteratively create and verify objects. Only operate on explicitly approved user scenes. " +
          "If Blender is in legacy procedural mode, use blender_status and generate_model only for basic placeholders; warn that this cannot produce detailed custom models. " +
          "Select an archetype and ask for silhouette, materials, rig and style if needed. Do not promise commercial text-to-3D fidelity. " +
          "Blender scene editing can execute Python. Respect safe mode, show planned changes, and request approval for external asset downloads or destructive operations. Animation still needs Roblox retargeting. " +
          "Do not automatically import unreviewed GLBs into Roblox; provide Studio File > Import instructions. " +
          "Do not call list_roblox_studios, search_game_tree or set_active_studio. Confirm changes with read-only inspection and warn before destructive edits.",
      },
    },
  };
}
