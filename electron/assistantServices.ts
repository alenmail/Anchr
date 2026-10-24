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
// Gemini 2.5 Flash is no longer accessible to many newly created API projects.
// Use Google's recommended low-latency image-capable model for new installs.
const DEFAULT_VISION_MODEL = "gemini-3.5-flash-lite";
const visionModelPath = () => join(app.getPath("userData"), "vision-model.txt");
const MODEL_ID = /^gemini-[a-z0-9][a-z0-9._-]{0,100}$/i;
const GOOGLE_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const VISION_MODEL_LIST_LIMIT = 200;
export type VisionModelOption = { id: string; label: string };

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
/** Lists models that advertise generateContent. Google may still limit access
 * at generation time, so 404 errors expose the selected model and recovery. */
export async function listVisionModels(): Promise<VisionModelOption[]> {
  const key = await keyFromStorage();
  if (!key) throw new Error("Save a Gemini API key before loading available vision models");
  const discovered = new Map<string, string>();
  let pageToken: string | undefined;
  for (let page = 0; page < 3; page++) {
    const url = new URL(GOOGLE_MODELS_URL);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, {
      headers: { "x-goog-api-key": key },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      const message = await googleErrorMessage(response);
      throw new Error(`Couldn't load Gemini models (HTTP ${response.status}). ${message}`);
    }
    const data = await response.json() as {
      models?: Array<{ name?: string; displayName?: string; supportedGenerationMethods?: string[] }>;
      nextPageToken?: string;
    };
    for (const entry of data.models ?? []) {
      const id = entry.name?.replace(/^models\//, "") ?? "";
      if (!MODEL_ID.test(id) ||
          /(?:image|tts|audio|live|embedding|robotics|computer-use)/i.test(id) ||
          !entry.supportedGenerationMethods?.includes("generateContent")) continue;
      if (discovered.size >= VISION_MODEL_LIST_LIMIT) break;
      discovered.set(id, entry.displayName?.slice(0, 110) || id);
    }
    if (!data.nextPageToken || discovered.size >= VISION_MODEL_LIST_LIMIT) break;
    pageToken = data.nextPageToken;
  }
  return [...discovered].map(([id, label]) => ({ id, label })).sort((a,b) =>
    Number(b.id === DEFAULT_VISION_MODEL) - Number(a.id === DEFAULT_VISION_MODEL) ||
    a.id.localeCompare(b.id));
}

export async function getVisionModel(): Promise<string> {
  try {
    const saved = (await readFile(visionModelPath(), "utf8")).trim();
    return MODEL_ID.test(saved) ? saved : DEFAULT_VISION_MODEL;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return DEFAULT_VISION_MODEL;
    throw error;
  }
}

export async function setVisionModel(id: string): Promise<string> {
  if (typeof id !== "string" || !MODEL_ID.test(id))
    throw new Error("Select a valid Gemini model from the model list");
  const available = await listVisionModels();
  if (!available.some((item) => item.id === id))
    throw new Error("That model isn't in the list returned by your Gemini API key. Refresh the list.");
  await writeFile(visionModelPath(), id, { mode: 0o600 });
  return id;
}

/** Include a safe, bounded Google error description; never log credentials. */
async function googleErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json() as { error?: { message?: string } };
    if (typeof data.error?.message === "string")
      return data.error.message.replace(/\s+/g, " ").slice(0, 500);
  } catch { /* Non-JSON response */ }
  return "Check your API key, model availability and usage quota.";
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
  const model = await getVisionModel();
  const response = await fetch(`${GOOGLE_MODELS_URL}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ parts: content }], generationConfig: { maxOutputTokens: 1200, temperature: 0.15 } }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) {
    const detail = await googleErrorMessage(response);
    if (response.status === 404) throw new Error(
      `Gemini model "${model}" is unavailable for your API project (HTTP 404). ` +
      `Go to Settings → Providers → Image understanding → Change, refresh the model list and choose an accessible model. ${detail}`
    );
    if (response.status === 429) throw new Error(
      `Your Gemini API quota or rate limit has been reached for "${model}" (HTTP 429). ${detail}`
    );
    if (response.status === 401 || response.status === 403) throw new Error(
      `Gemini API key or project permission rejected for "${model}" (HTTP ${response.status}). ${detail}`
    );
    throw new Error(`Gemini image analysis failed for "${model}" (HTTP ${response.status}). ${detail}`);
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

/**
 * Curated Roblox visual reference index. Only links to source images; nothing
 * from this third-party catalog is redistributed or imported as a game asset.
 * Individual images may be copyrighted and are untrusted reference material.
 */
let robloxReferenceCache: {paths:string[];loadedAt:number}|null=null;
async function searchRobloxReferenceCatalog(term:string):Promise<WebReference[]>{
  const now=Date.now();
  if(!robloxReferenceCache||now-robloxReferenceCache.loadedAt>30*60*1000){
    const res=await fetch("https://api.github.com/repos/izzyfrm/roblox-ai/git/trees/main?recursive=1",{
      headers:{Accept:"application/vnd.github+json","User-Agent":"Anchr-visual-references"},
      signal:AbortSignal.timeout(12000)});
    if(!res.ok)throw Error("Roblox visual reference library unavailable");
    const body=await res.text();
    if(body.length>5_000_000)throw Error("Visual reference catalog too large");
    const data=JSON.parse(body) as {truncated?:boolean;tree?:Array<{path:string;type:string}>};
    if(data.truncated||!Array.isArray(data.tree))throw Error("Incomplete visual reference catalog");
    const prefixes=["previews/","ui-styles/","visual-refs/","style-refs/","game-refs/","vfx/","logos/","thumbnails/","animations/"];
    const paths=data.tree.filter(entry=>entry.type==="blob"&&
        prefixes.some(prefix=>entry.path.startsWith(prefix))&&
        /\\.(png|jpe?g|webp|gif)$/i.test(entry.path))
      .map(entry=>entry.path);
    robloxReferenceCache={paths,loadedAt:now};
  }
  const words=term.toLowerCase().match(/[a-z0-9]+/g)?.filter(w=>w.length>2).slice(0,6)||[];
  const ranked=robloxReferenceCache.paths.map(path=>{
    const normalized=path.toLowerCase().replace(/[-_]/g," ");
    const name=path.split("/").pop()?.toLowerCase().replace(/[-_]/g," ")||"";
    const matches=words.filter(w=>normalized.includes(w));
    return {path,score:matches.reduce((n,w)=>n+(name.includes(w)?3:1),0)};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path)).slice(0,6);
  return ranked.map(({path})=>{
    const encoded=path.split("/").map(encodeURIComponent).join("/");
    return {title:path.split("/").pop()!.replace(/[-_]/g," ").replace(/\\.[^.]+$/,"").slice(0,130),
      url:"https://github.com/izzyfrm/roblox-ai/blob/main/"+encoded,
      imageUrl:"https://raw.githubusercontent.com/izzyfrm/roblox-ai/main/"+encoded,
      description:"Roblox visual reference library · inspiration only; image rights remain with original creators."};
  });
}

export async function findVisualReferences(input: string): Promise<WebReference[]> {
  if (typeof input !== "string" || !input.trim() || input.length > 250)
    throw new Error("Use a short visual reference search");
  const term = input.trim();
  // Prefer specialized Roblox UI / game art references where available.
  const results: WebReference[] = await searchRobloxReferenceCatalog(term)
    .catch(error=>{console.warn("[Anchr] Roblox reference catalog unavailable:",error);return [];});
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
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  for (const [key, value] of Object.entries({
    action: "query", generator: "search", gsrsearch: term,
    gsrnamespace: "6", gsrlimit: "8", prop: "imageinfo",
    iiprop: "url|extmetadata", iiurlwidth: "640", format: "json", formatversion: "2",
  })) url.searchParams.set(key, value);
  let data: any = {};
  try { data = await jsonFrom(url.toString()); }
  catch(error){ console.warn("[Anchr] Wikimedia visual reference search unavailable:",error); }
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
