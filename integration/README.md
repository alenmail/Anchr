# Anchr integration

This directory holds the first concrete migration modules for changing BloxBot's native Studio MCP connection to the Chrrxs plugin/server approach.

These are development sources, **not yet a runnable complete application**.

The complete Anchr desktop source will be based on the MIT-licensed BloxBot repository, with the Chrrxs source vendored under `vendor/robloxstudio-mcp-source`.

## Integration priorities

1. Rebrand the Chrrxs plugin's toolbar and dock to **Anchr** with **Stone** as developer, retaining upstream license notices.
2. Bundle Chrrxs MCP server and plugin as Anchr assets.
3. Swap BloxBot's native helper resolver for `electron/anchrMcpHelper.ts`.
4. Replace `list_roblox_studios` calls with `get_connected_instances`; Chrrxs scopes tools using `instance_id`, not BloxBot's previous `studio_id`.
5. Adapt Explorer to `get_project_structure`. Confirm that the returned hierarchy validates against BloxBot's Explorer contract.
6. Remove BloxBot's original updater/telemetry endpoints; don't silently point Anchr at original-product services.
7. Build and run an end-to-end smoke test with Roblox Studio before describing the installer as finished.

## Original source

- https://github.com/paralov/app-bloxbot-ai
- https://github.com/Chrrxs/robloxstudio-mcp

Both projects retain their own license and copyright notices.
