import { app } from "electron";
import { join } from "node:path";
import type { StudioMcpHelper } from "./studioMcpHelper";

/** Anchr exclusively launches Chrrxs' bundled server, never StudioMCP.exe/mcp.bat. */
export async function resolveAnchrMcpHelper(): Promise<StudioMcpHelper> {
  const root = process.env.ANCHR_MCP_ROOT ??
    (app.isPackaged
      ? join(process.resourcesPath, "anchr-mcp")
      : join(process.cwd(), "vendor", "anchr-mcp"));
  const dir = join(root, "node_modules", "@chrrxs", "robloxstudio-mcp");
  return {
    command: [
      process.execPath,
      join(dir, "dist", "index.js"),
      "--auto-install-plugin",
      "--plugin-path",
      join(dir, "studio-plugin", "MCPPlugin.rbxmx"),
    ],
    installPath: join(dir, "dist", "index.js"),
    source: null,
  };
}
