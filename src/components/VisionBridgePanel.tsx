import { useEffect, useState } from "react";
import { Eye, LockKeyhole, CheckCircle2 } from "lucide-react";
import { desktop } from "@/lib/desktop";

/** Optional, explicitly authorized free-tier image understanding provider. */
export default function VisionBridgePanel() {
  const [configured, setConfigured] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void desktop.visionConfigured().then(setConfigured).catch(() => undefined); }, []);

  async function save(clear = false) {
    setBusy(true); setError("");
    try {
      const enabled = await desktop.setVisionApiKey(clear ? "" : key);
      setConfigured(enabled); setKey(""); setExpanded(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the key");
    } finally { setBusy(false); }
  }
  return <section className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-[#111a25]">
    <div className="flex items-start gap-3 p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-400/10 text-sky-300"><Eye size={18}/></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><p className="text-[13px] font-semibold">Image understanding</p>{configured && <CheckCircle2 size={13} className="text-emerald-400"/>}</div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Optional Gemini 2.5 Flash vision bridge. Reads screenshots and sends a description to your text-only coding model.</p>
      </div>
      <button type="button" onClick={() => setExpanded(!expanded)} className="rounded-lg border px-3 py-1.5 text-[11px]">{configured ? "Change" : "Set up"}</button>
    </div>
    {expanded && <div className="space-y-3 border-t border-white/10 p-4">
      <label className="block text-[11px] font-medium">Gemini API key
        <input type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)}
          placeholder="Paste your Google AI Studio API key" className="mt-1.5 h-9 w-full rounded-lg border bg-background px-3 text-xs"/>
      </label>
      <p className="flex gap-1.5 text-[10px] leading-5 text-muted-foreground"><LockKeyhole className="mt-0.5 shrink-0" size={12}/>Encrypted locally using Windows secure storage. Images are sent only when you attach and submit them. Free-tier limits vary by account and can change; unlimited access is not guaranteed.</p>
      {error && <p role="alert" className="text-[11px] text-rose-300">{error}</p>}
      <div className="flex items-center gap-2"><button type="button" disabled={busy||!key.trim()} onClick={()=>void save()} className="rounded-lg bg-sky-500 px-3 py-2 text-[11px] font-semibold text-slate-950 disabled:opacity-40">Save vision key</button>
        {configured && <button type="button" disabled={busy} onClick={()=>void save(true)} className="rounded-lg border px-3 py-2 text-[11px]">Disconnect</button>}</div>
      <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="block text-[11px] text-sky-300 underline">Create a Gemini API key</a>
    </div>}
  </section>;
}
