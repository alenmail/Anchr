# Build and verification

GitHub Actions (Windows) checks out the pinned Chrrxs MCP submodule, compiles the Anchr-branded Studio plugin, installs/stages the matching MCP server package, builds the Electron UI, and produces an NSIS installer artifact.

Check the [Actions tab](https://github.com/alenmail/Anchr/actions/workflows/anchr-windows.yml) for the actual status. A successful packaging job is **not** the same as testing a running Roblox Studio instance: that needs an end-to-end smoke test on Windows with Roblox Studio installed.

Plugin label: **Anchr**, developer: **Stone**. The bundled Chrrxs MCP connection is the only Studio transport in the desktop app.

Do not publish release binaries to end users until the installer launches, installs Anchr Studio, connects to the plugin, edits a test script safely, and completes a playtest.

Current BloxBot hosted analytics, its updater and signed remote program feed are disabled.

Upstream MIT copyright notices remain in `LICENSE` and `vendor/robloxstudio-mcp/LICENSE`.
