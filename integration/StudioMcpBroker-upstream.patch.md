# Connection replacement

The upstream BloxBot file `electron/services/StudioMcpBroker.ts` connects to Roblox Studio's own native MCP helper.

For Anchr, keep BloxBot's local MCP HTTP broker, reconnection lifecycle, and tool forwarding, but replace the upstream resolver:

```ts
import { resolveAnchrMcpHelper } from "../anchrMcpHelper";
```

Within `makeStudioMcpBrokerLayer`, replace the native helper resolver with
`await resolveAnchrMcpHelper()`. Retain its existing connection and retry controls.

In the spawned MCP stdio process, set the environment's `ELECTRON_RUN_AS_NODE` to `"1"` so Electron can run the bundled JS CLI as a Node child process. Electron builds must package the **entire** compiled Chrrxs server and dependencies, not only its entry file.

Check **get_connected_instances** to verify that a Studio plugin is actually connected; a healthy MCP server without any Roblox Studio peers is not a Studio connection.

Do not use the official Studio `StudioMCP.exe` or `mcp.bat` in the Anchr runtime.

Security: keep loopback-only broker and authentication protections; do not bind an unauthenticated MCP endpoint to public interfaces.
