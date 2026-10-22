# Anchr Studio toolbar icon

The desktop splash uses `src/assets/anchr-mark.svg`: a transparent Anchr symbol, not an icon-within-an-icon.

The Windows build generates `assets/anchr-studio-toolbar.png` (transparent, 512 × 512) from the Anchr mark. Roblox Studio toolbar image icons require a Roblox-hosted **Image asset ID** rather than a path to an ordinary local PNG.

Until an Anchr Image asset ID is provided, the plugin displays **Anchr** as text. The inherited green **M** image is deliberately removed.

To enable the full graphical Anchr toolbar symbol without changing source code:

1. Upload `anchr-studio-toolbar.png` to Roblox Creator Dashboard as an **Image** under the desired creator/group.
2. Copy its actual Image asset ID (not an unrelated decal page ID).
3. In GitHub repo Settings → Secrets and variables → Actions → **Variables**, set `ANCHR_STUDIO_ICON_ASSET_ID` to that numeric Image ID.
4. Re-run the Windows build workflow or push a commit. The build replaces all three connection-state icons with that Anchr image.

This step requires authorization from the owner of the Roblox creator account; GitHub access alone cannot upload an image to Roblox. The desktop installer packages and installs the branded Studio plugin as before.
