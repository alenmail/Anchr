import { app } from "electron";
import { access } from "node:fs/promises";
import { join } from "node:path";

/**
 * Anchr uses the Chrrxs MCP server, NOT Roblox Studio's built-in StudioMCP helper.
 *
 * Development:
 *   pnpm --dir vendor/robloxstudio-mcp-source build
 *
 * Release builds must include the compiled server at
 *   resources/anchr-mcp/packages/robloxstudio-mcp/dist/index.js
 */
export async function resolveAnchrMcpHelper(): Promise<{
  command: string[];
  installPath: string;
  source: null;
}> {
  const base = app.isPackaged
    ? join(process.resourcesPath, "anchr-mcp")
    : join(process.cwd(), "vendor", "robloxstudio-mcp-source");
  const entry = join(base, "packages", "robloxstudio-mcp", "dist", "index.js");
  await access(entry);
  return {
    command: [process.execPath, entry, "--auto-install-plugin"],
    installPath: entry,
    source: null,
  };
}
