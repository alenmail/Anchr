# Anchr

**Anchr** is an AI-assisted Roblox Studio development application by **Stone**.

This repository is the independent development home for the Anchr desktop client and Anchr Studio plugin, built from the following MIT-licensed open-source projects:

- [BloxBot AI](https://github.com/paralov/app-bloxbot-ai) — Electron / React desktop client and OpenCode integration.
- [Chrrxs Roblox Studio MCP](https://github.com/Chrrxs/robloxstudio-mcp) — Roblox Studio plugin and MCP server.

## Development status

The Anchr connection architecture is being integrated. The intended end-to-end route is:

Anchr desktop → local MCP broker → Chrrxs MCP server → Anchr Studio plugin → Roblox Studio.

The original Studio built-in MCP helper is **not** the intended connection method.

This repository is in active development; do not assume working installers or a tested Roblox Studio connection until validation has been completed.

## License and attribution

Retain the original MIT license notices for each upstream component. Anchr branding is by Stone.
