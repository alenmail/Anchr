import { app, BrowserWindow, desktopCapturer, safeStorage, screen } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Anchr's optional vision bridge:
 * - the user's Gemini key is encrypted by Electron safeStorage (Windows DPAPI);
 * - images are only uploaded after explicit attachment/send;
 * - captions, not original images, go to a text-only coding provider.
 */
const visionKeyPath = () => join(app.getPath("userData"), "vision-key.enc");
const VISION_MODEL = "gemini-2.5-flash";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SUPPORTED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export type ImageForVision = { mime: string; dataUrl: string };
export type WebReference = { title: string; url: string; imageUrl?: string; description?: string };

async function keyFromStorage(): Promise<string | null> {
  try {
    const encrypted = await readFile(visionKeyPath());
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Secure key storage is unavailable");
    return safeStorage.decryptString(encrypted);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function visionIsConfigured(): Promise<boolean> {
  return Boolean(await keyFromStorage());
}
export async function saveVisionKey(key: string): Promise<boolean> {
  if (typeof key !== "string" || key.length > 512) throw new Error("Invalid vision API key");
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows secure storage is unavailable");
  if (!key.trim()) {
    const { rm } = await import("node:fs/promises");
    await rm(visionKeyPath(), { force: true });
    return false;
  }
  const encrypted = safeStorage.encryptString(key.trim());
  await writeFile(visionKeyPath(), encrypted, { mode: 0o600 });
  return true;
}
function partsForImage(image: ImageForVision): { inline_data: { mime_type: string; data: string } } {
  if (!image || !SUPPORTED.has(image.mime) || typeof image.dataUrl !== "string")
    throw new Error("Only PNG, JPEG, GIF and WebP images can be analyzed");
  const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(image.dataUrl);
  if (!match || `image/${match[1]}` !== image.mime || match[2].length > MAX_IMAGE_BYTES * 1.38)
    throw new Error("Image format is invalid or the image exceeds the 5 MB vision limit");
  return { inline_data: { mime_type: image.mime, data: match[2] } };
}
export async function describeImages(images: ImageForVision[], context: string): Promise<string> {
  if (!Array.isArray(images) || images.length < 1 || images.length > 5)
    throw new Error("Choose between 1 and 5 images");
  const key = await keyFromStorage();
  if (!key) throw new Error("Set up the free-tier Gemini vision bridge in Settings → Providers first");
  const content = [
    { text: `Describe these screenshots for a TEXT-ONLY Roblox Studio coding assistant. Be precise about layout, objects, colors, proportions, and visible text. Do not invent unseen elements. Note ambiguity. User request: ${String(context).slice(0,3000)}. Return a concise technical visual description, not a response to the user.` },
    ...images.map(partsForImage),
  ];
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ parts: content }], generationConfig: { maxOutputTokens: 1200, temperature: 0.15 } }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) {
    if (response.status === 429) throw new Error("Gemini's free-tier quota was reached. Retry later or use a different key/model.");
    throw new Error(`Image analysis failed (HTTP ${response.status}). Verify the API key and free-tier access.`);
  }
  const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim();
  if (!text) throw new Error("The vision model did not return a description");
  return text.slice(0,12000);
}

export async function captureStudioScreen(): Promise<ImageForVision> {
  // Only invoked when the user explicitly chooses Capture screenshot.
  // Temporarily hide Anchr so the capture shows Roblox Studio underneath.
  const window = BrowserWindow.getFocusedWindow();
  const displayId = window ? String(screen.getDisplayMatching(window.getBounds()).id) : undefined;
  const wasVisible = Boolean(window?.isVisible());
  if (wasVisible) window?.hide();
  try {
    await new Promise(resolve => setTimeout(resolve, 220));
    const screens = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 1600, height: 900 } });
    const selected = screens.find(item => item.display_id === displayId && !item.thumbnail.isEmpty()) ??
      screens.find(item => !item.thumbnail.isEmpty());
    if (!selected) throw new Error("No desktop screen could be captured");
    return { mime: "image/png", dataUrl: selected.thumbnail.toDataURL() };
  } finally {
    if (wasVisible && window && !window.isDestroyed()) {
      window.show();
      window.focus();
    }
  }
}

async function jsonFrom(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { "User-Agent": "Anchr/0.1.4 (Roblox Studio development references)" } });
  if (!res.ok) throw new Error(`Reference service returned HTTP ${res.status}`);
  const text = await res.text();
  if (text.length > 900000) throw new Error("Reference response was too large");
  return JSON.parse(text);
}

export async function findVisualReferences(input: string): Promise<WebReference[]> {
  if (typeof input !== "string" || !input.trim() || input.length > 250)
    throw new Error("Use a short visual reference search");
  const term = input.trim();
  const results: WebReference[] = [];
  // Openverse indexes openly-licensed visual references across providers;
  // it has a documented free anonymous search API with its own rate limits.
  try {
    const openverse = new URL("https://api.openverse.org/v1/images/");
    openverse.searchParams.set("q", term.slice(0, 180));
    openverse.searchParams.set("page_size", "6");
    const response = await jsonFrom(openverse.toString());
    const found = Array.isArray(response.results) ? response.results : [];
    for (const item of found) {
      const target = typeof item.foreign_landing_url === "string" ? item.foreign_landing_url : "";
      if (!target || !target.startsWith("https://")) continue;
      const id = typeof item.id === "string" && /^[a-z0-9-]{8,64}$/i.test(item.id) ? item.id : "";
      const imageUrl = id ? `https://api.openverse.org/v1/images/${id}/thumb/?compressed=true` : undefined;
      const credit = [item.creator, item.license].filter((value): value is string => typeof value === "string").join(" · ");
      results.push({
        title: String(item.title ?? "Reference").slice(0, 160),
        url: target,
        ...(imageUrl ? { imageUrl } : {}),
        description: credit ? `Attribution/license: ${credit.slice(0,120)}` : undefined,
      });
    }
  } catch (error) {
    console.warn("[Anchr] Openverse reference lookup unavailable; checking Commons:", error);
  }
  if (results.length >= 6) return results.slice(0, 6);
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  for (const [key, value] of Object.entries({
    action: "query", generator: "search", gsrsearch: term,
    gsrnamespace: "6", gsrlimit: "8", prop: "imageinfo",
    iiprop: "url|extmetadata", iiurlwidth: "640", format: "json", formatversion: "2",
  })) url.searchParams.set(key, value);
  const data = await jsonFrom(url.toString());
  const pages = (data.query?.pages ?? []) as any[];
  for (const page of pages) {
    const image = page.imageinfo?.[0];
    if (!image?.descriptionurl || typeof image.descriptionurl !== "string") continue;
    const source = new URL(image.descriptionurl);
    if (source.protocol !== "https:" || !source.hostname.endsWith(".wikimedia.org")) continue;
    const thumb = typeof image.thumburl === "string" && image.thumburl.startsWith("https://") ? image.thumburl : undefined;
    results.push({
      title: String(page.title ?? "Reference").replace(/^File:/, "").slice(0, 180),
      url: image.descriptionurl,
      ...(thumb ? { imageUrl: thumb } : {}),
      description: typeof image.extmetadata?.ImageDescription?.value === "string"
        ? image.extmetadata.ImageDescription.value.replace(/<[^>]*>/g, " ").slice(0, 280) : undefined,
    });
  }
  const chosen = results.slice(0,6);
  // Visual reference descriptions require the *separately configured* vision
  // key. Without it, we return public titles and attribution links only.
  // Fetch no more than two thumbnails to respect latency, quotas and traffic.
  if (chosen.length && await visionIsConfigured()) {
    const images = await Promise.all(chosen.slice(0,2).map(async ref => {
      if (!ref.imageUrl) return null;
      try {
        const parsed = new URL(ref.imageUrl);
        if (parsed.protocol !== "https:" || !(
          parsed.hostname.endsWith(".wikimedia.org") || parsed.hostname === "api.openverse.org")) return null;
        const response = await fetch(parsed.toString(), { signal: AbortSignal.timeout(9000) });
        const mime = (response.headers.get("content-type") ?? "").split(";")[0].trim();
        if (!response.ok || !SUPPORTED.has(mime) || Number(response.headers.get("content-length") ?? 0) > 3_000_000)
          return null;
        const finalHost = new URL(response.url).hostname;
        if (!(finalHost.endsWith(".wikimedia.org") || finalHost === "api.openverse.org")) return null;
        const image = Buffer.from(await response.arrayBuffer());
        if (image.length > 3_000_000) return null;
        return { mime, dataUrl: `data:${mime};base64,${image.toString("base64")}` };
      } catch { return null; }
    }));
    const available = images.filter((image): image is ImageForVision => image !== null);
    if (available.length) {
      try {
        const summary = await describeImages(available,
          `Describe the visual appearance of these public Commons search results for: ${term}. Describe only what you actually see; do not infer copyrighted character traits or copy assets.`);
        chosen[0].description = `Visual observations from ${available.length} openly-licensed search images: ${summary.slice(0,2400)}`;
      } catch (error) {
        console.warn("[Anchr] Visual reference image interpretation unavailable:", error);
      }
    }
  }
  // These sources are visual guidance with citations, not permission to
  // republish someone else's copyrighted asset in a Roblox experience.
  return chosen;
}
