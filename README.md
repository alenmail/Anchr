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
- Anchr checks its own GitHub Releases for updates. **Install and restart** is an explicit user action from Settings → About; the updater needs versioned metadata and an installed Windows build. Upstream product telemetry remains disabled.

## Assistant workflows (v0.1.4 beta)

**Screenshots and images:** Click the paperclip in chat to choose **Capture screenshot** or **Choose image files**. You can also paste (Ctrl+V) or drag PNG/JPEG/WebP/GIF images. The screenshot action temporarily hides Anchr to capture Roblox Studio on the same monitor. Review the preview before sending.

**Optional image understanding for text-only models:** Settings → Providers → **Image understanding** accepts a Gemini API key. The key is encrypted locally with Electron secure storage. When you submit attached images, Anchr sends them to Gemini 2.5 Flash for a text description and passes only that description to the selected coding model. If the bridge is unavailable or quota is exhausted, it reports an error; it does not silently invent a caption. This service is not unlimited: free-tier availability and rate limits depend on Google and your account. Any submitted image is processed by the selected third-party vision provider.

**Web visual references:** The Globe toggle in chat permits searches for openly licensed imagery through Openverse and Wikimedia Commons when a request mentions appearances or character inspiration. Anchr includes source/credit URLs and, when vision is connected, observations from at most two image thumbnails. **Results are not guaranteed for every character**, and the service cannot automatically license or import other people's artwork. Openverse's anonymous API is rate-limited.

**Improve prompt:** The wand control asks the model already selected in chat to draft a clearer prompt in a temporary session. Nothing is sent to Studio and the improved prompt is not used until you explicitly approve it. This consumes API quota for your selected model.

**Streaming:** Chat follows streamed content while you remain at the bottom. Scroll up to pause following; scroll back down to resume. Preparation work for web references and vision happens concurrently. Actual model response speed still depends on the connected API provider.

**App updates:** Settings → About → **Check for updates** checks official Anchr GitHub Releases. If a newer compatible release is available, **Install and restart** downloads and installs it. Updates are user-initiated. v0.1.3 and earlier don't contain this update mechanism and need a one-time manual installation of a newer version.

For secure testing, use a fresh Roblox Studio project before allowing AI editing tools to modify a production place.


## Creative Tools (v0.2.0 experimental)

Go to **Settings → Creative Tools**. The Windows installer bundles Blender 4.5.15 headless, a local Blender MCP worker, and 24 free transparent PNG icons. The normal workflow is:

1. Ask Anchr to use **anchr-blender** MCP to generate a model. It will choose an archetype, materials and one of the basic idle/walk/run/attack presets.
2. Preview the exported `preview.png`, review/edit `model.blend`, and import `model.glb` with **Roblox Studio → File → Import 3D**. Roblox supports glTF/FBX via its official importer; Studio-specific user authorization is needed for asset imports.
3. For Figma, use **Settings → Creative Tools → Connect Figma** with a personal API token granting `file_content:read`, paste the file URL, choose a frame, generate Luau and **explicitly approve** applying it to connected Studio. Tokens are encrypted using OS secure storage, never sent to AI models.
4. The icon pack opens as PNGs; Roblox images still need to be uploaded using your creator permissions before they can be displayed in a live game.
5. Manage new Anchr versions in **Settings → Updates**. The app already uses Electron's GitHub prerelease update channel.

**Limitations:** This is a deterministic procedural Blender backend, not a trained text-to-3D model. It produces proper mesh files and basic keyframes but cannot guarantee photorealistic characters, R15-ready rigs or production-quality animations. Figma import maps frames/text/basic styling; images and vectors are explicitly marked for manual asset upload. No paid APIs are mandatory beyond the user-selected text model, but Figma access remains account-specific and external references can have their own rules.

### Local builds

On Windows run `pnpm install`, `pnpm prepare:blender`, `pnpm icons:anchr`, `pnpm icons:creative`, `pnpm stage:anchr-mcp`, `pnpm build`, then `pnpm exec electron-builder --win nsis --publish never`. Downloaded Blender files are SHA-256 validated and not committed to Git. The bundled Blender makes the installer several hundred megabytes larger. All third-party licenses must be retained during redistribution.
