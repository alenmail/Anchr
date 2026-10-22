# Anchr

**Anchr** is a desktop AI development companion for Roblox Studio by **Stone**.

![Anchr mark](public/anchr-logo.svg)

The desktop is a customized MIT-licensed application. It connects **only** to a locally bundled server and its **Anchr Studio** Roblox plugin; the native Roblox Studio MCP helper is no longer used by the desktop runtime.

## How it works

Anchr desktop → localhost MCP broker → bundled Chrrxs MCP server (Node stdio) → Anchr Studio plugin (local HTTP/WebSocket) → Roblox Studio.

The MCP server package and branded plugin are installed by Anchr's packaging stage. At runtime Anchr attempts to install/update the plugin. Restart Roblox Studio after its first installation.

## Build (Windows primary target)

1. Install Node.js 22+, pnpm, Python 3 and Pillow (`python -m pip install Pillow`).
2. Clone this repository with submodules: `git clone --recurse-submodules https://github.com/alenmail/Anchr.git`. If already cloned: `git submodule update --init --recursive`.
3. Run `pnpm install`.
4. Run `pnpm icons:anchr`.
5. Run `pnpm stage:anchr-mcp`. This compiles the branded Studio plugin and stages Chrrxs' Node server.
6. Run `pnpm build` and `pnpm dev` for development, or `pnpm package` for a Windows installer.

CI builds use the same steps. No npm installation is required for users of the packaged desktop.

### Notes

- Roblox Studio must allow local HTTP requests for plugin communications. Anchr does **not** require toggling Studio's built-in `Enable Studio as MCP server`.
- The Studio plugin is based on the full Chrrxs implementation (debugging, playtesting, performance tools). Tool availability depends on the server's supported version and Studio session state.
- Only local MCP broker interfaces are intended to be exposed. Do not expose them to other computers.
- Anchr is not affiliated with Roblox.
- This is not a verified production release until Windows CI and real Roblox Studio integration tests have passed.
- Automatic updates and upstream product telemetry are disabled until Anchr controls its own release infrastructure.
