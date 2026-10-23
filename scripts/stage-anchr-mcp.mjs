/**
 * Assemble the *real* Chrrxs MCP server and an Anchr-branded Studio plugin.
 * Builds a local plugin from our pinned Git submodule, then bundles the matching
 * published Chrrxs MCP server so end users do not need Node, npm, or Git.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const studio = join(root, "vendor", "robloxstudio-mcp");
const plugin = join(studio, "studio-plugin");
const stage = join(root, "vendor", "anchr-mcp");
const pkg = join(stage, "node_modules", "@chrrxs", "robloxstudio-mcp");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
function run(command, args, cwd = root) {
  const cmd = spawnSync(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (cmd.error) throw cmd.error;
  if (cmd.status !== 0) throw new Error(`${command} ${args.join(" ")} exited with ${cmd.status}`);
}
function change(relative, oldText, newText) {
  const file = join(studio, relative);
  if (!existsSync(file)) throw new Error("The Chrrxs Git submodule is missing: " + file);
  const src = readFileSync(file, "utf8");
  if (src.includes(newText)) return; // Idempotent when invoked more than once.
  if (!src.includes(oldText)) throw new Error("Upstream changed: " + relative + ": " + oldText);
  writeFileSync(file, src.replace(oldText, newText));
}

change("scripts/build-plugin.mjs", "scriptName: 'MCPPlugin'", "scriptName: 'AnchrStudio'");
change("scripts/build-plugin.mjs", "toolbarName: 'MCP Integration'", "toolbarName: 'Anchr'");
change("scripts/build-plugin.mjs", "buttonTitle: 'MCP Server'", "buttonTitle: 'Anchr'");
change("scripts/build-plugin.mjs", "buttonTooltip: 'Connect to MCP Server for AI Integration'", "buttonTooltip: 'Anchr Studio by Stone'");

// Roblox requires a hosted Image asset ID for a graphical toolbar icon.
// If no Anchr image is uploaded yet, show the Anchr text label rather than
// reusing Chrrxs' unrelated green M icon.
const toolbarIconId = (process.env.ANCHR_STUDIO_ICON_ASSET_ID ?? "").trim();
if (toolbarIconId && !/^\d{9,20}$/.test(toolbarIconId))
  throw new Error("ANCHR_STUDIO_ICON_ASSET_ID must be the numeric Roblox Image asset ID");
for (const [variant, original] of [
  ["Disconnected", "75876056391496"],
  ["Connecting", "71302583919560"],
  ["Connected", "130958234173611"],
]) {
  change("scripts/build-plugin.mjs",
    `buttonIcon${variant}: '${original}'`,
    `buttonIcon${variant}: '${toolbarIconId}'`);
}
// Use a typed function so roblox-ts does not reject a compile-time
// comparison of literal placeholders (TS2367). Placeholders are substituted
// only after the plugin has been compiled.
for (const state of ["DISCONNECTED", "CONNECTING", "CONNECTED"]) {
  change("studio-plugin/src/server/index.server.ts",
    `const ICON_${state} = "rbxassetid://__BUTTON_ICON_${state}__";`,
    `const ICON_${state} = getAnchrToolbarIcon("__BUTTON_ICON_${state}__");`);
}
change("studio-plugin/src/server/index.server.ts",
  'const ICON_DISCONNECTED = getAnchrToolbarIcon("__BUTTON_ICON_DISCONNECTED__");',
  'function getAnchrToolbarIcon(assetId: string): string { return assetId === "" ? "" : "rbxassetid://" + assetId; }\nconst ICON_DISCONNECTED = getAnchrToolbarIcon("__BUTTON_ICON_DISCONNECTED__");');
change("studio-plugin/src/server/index.server.ts",
  'toolbar.CreateButton("__BUTTON_TITLE__", "__BUTTON_TOOLTIP__", ICON_DISCONNECTED)',
  'toolbar.CreateButton("__BUTTON_TITLE__", "__BUTTON_TOOLTIP__", ICON_DISCONNECTED, "Anchr")');
change("studio-plugin/src/modules/UI.ts", "`MCP Server v${CURRENT_VERSION}`", "`Anchr Studio v${CURRENT_VERSION}`");
change("studio-plugin/src/modules/UI.ts", '<font color="#F0F0F0">MCP</font>', '<font color="#F0F0F0">Anchr</font>');
change("studio-plugin/src/modules/UI.ts", '<font color="#999999">github</font> <font color="#CCCCCC">Chrrxs/robloxstudio-mcp</font>', '<font color="#999999">by</font> <font color="#CCCCCC">Stone</font>');
change("studio-plugin/src/modules/UI.ts", 'bg: Color3.fromRGB(14, 14, 14)', 'bg: Color3.fromRGB(8, 13, 20)');
change("studio-plugin/src/modules/UI.ts", 'card: Color3.fromRGB(22, 22, 22)', 'card: Color3.fromRGB(15, 23, 34)');
change("studio-plugin/src/modules/UI.ts", 'surface: Color3.fromRGB(30, 30, 30)', 'surface: Color3.fromRGB(22, 37, 54)');
change("studio-plugin/src/modules/UI.ts", 'border: Color3.fromRGB(38, 38, 38)', 'border: Color3.fromRGB(35, 58, 83)');
change("studio-plugin/src/modules/UI.ts", 'green: Color3.fromRGB(52, 211, 153)', 'green: Color3.fromRGB(0, 197, 238)');
change("studio-plugin/src/modules/UI.ts", 'yellow: Color3.fromRGB(251, 191, 36)', 'yellow: Color3.fromRGB(58, 155, 255)');
const metadata = join(plugin, "plugin.json");
const info = JSON.parse(readFileSync(metadata, "utf8"));
Object.assign(info, {
  Name: "Anchr Studio",
  Description: "Anchr by Stone — Roblox Studio AI development, debugging and playtesting",
  Author: "Stone",
  Id: "anchr-studio-plugin",
});
writeFileSync(metadata, JSON.stringify(info, null, 2) + "\n");

run(npm, ["ci", "--no-audit", "--no-fund"], plugin);
run(npm, ["run", "build:plugin:artifact"], studio);
const built = join(plugin, "MCPPlugin.rbxmx");
if (!existsSync(built)) throw new Error("Anchr plugin build did not produce MCPPlugin.rbxmx");

mkdirSync(stage, { recursive: true });
run(npm, ["install", "--prefix", stage, "--no-save", "--omit=dev", "--no-audit", "--no-fund", "@chrrxs/robloxstudio-mcp@3.3.0", "@modelcontextprotocol/sdk@1.26.0"]);
const cli = join(pkg, "dist", "index.js");
if (!existsSync(cli)) throw new Error("Bundled Chrrxs MCP server executable missing");
mkdirSync(join(pkg, "studio-plugin"), { recursive: true });
copyFileSync(built, join(pkg, "studio-plugin", "MCPPlugin.rbxmx"));
// Keep the upstream license with the redistributed server.
copyFileSync(join(studio, "LICENSE"), join(stage, "CHRRXS-LICENSE"));
// Stage the local Blender MCP worker next to the installed MCP SDK so Node can resolve it.
copyFileSync(join(root, "creative", "blender-mcp.mjs"), join(stage, "node_modules", "anchr-blender-mcp.mjs"));
copyFileSync(join(root, "creative", "blender_backend.py"), join(stage, "node_modules", "anchr-blender-backend.py"));
console.log(`[Anchr] Blender MCP worker staged.`);
console.log(`[Anchr] Bundled Studio plugin; toolbar icon: ${toolbarIconId ? `asset ${toolbarIconId}` : "Anchr text (no legacy M icon)"}.`);
