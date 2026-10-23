import { useCallback, useEffect, useState } from "react";
import { Eye, LockKeyhole, CheckCircle2, RefreshCw } from "lucide-react";
import { desktop } from "@/lib/desktop";

type Model = { id: string; label: string };

/** Optional, explicitly authorized Gemini image-understanding provider. */
export default function VisionBridgePanel() {
  const [configured, setConfigured] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [currentModel, setCurrentModel] = useState("gemini-3.5-flash-lite");
  const [selectedModel, setSelectedModel] = useState("gemini-3.5-flash-lite");
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    void Promise.all([desktop.visionConfigured(), desktop.getVisionModel()])
      .then(([enabled, model]) => {
        setConfigured(enabled);
        setCurrentModel(model);
        setSelectedModel(model);
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : "Could not read vision settings"));
  }, []);

  const refreshModels = useCallback(async () => {
    setLoadingModels(true);
    setError("");
    try {
      const options = await desktop.listVisionModels();
      setModels(options);
      if (!options.length) throw new Error("Your API key returned no supported Gemini text-and-vision models.");
      const active = await desktop.getVisionModel();
      setCurrentModel(active);
      setSelectedModel(options.some(item => item.id === active) ? active : options[0].id);
      setStatus(options.some(item => item.id === active)
        ? "Choose a different model if screenshots fail."
        : `Your previous model is not listed. Select and save another model to use screenshots.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not fetch Gemini models");
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    if (expanded && configured && models.length === 0) void refreshModels();
  }, [expanded, configured, models.length, refreshModels]);

  async function saveKey(clear = false) {
    setBusy(true); setError(""); setStatus("");
    try {
      const enabled = await desktop.setVisionApiKey(clear ? "" : key);
      setConfigured(enabled);
      setKey("");
      setModels([]);
      if (enabled) {
        setExpanded(true);
        setStatus("Key saved securely. Loading models for your account…");
      } else {
        setExpanded(false);
        setStatus("Image understanding disconnected.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the key");
    } finally {
      setBusy(false);
    }
  }

  async function saveModel() {
    setBusy(true); setError(""); setStatus("");
    try {
      const saved = await desktop.setVisionModel(selectedModel);
      setCurrentModel(saved);
      setStatus(`Selected ${saved}. Screenshots will use this model.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your model");
    } finally {
      setBusy(false);
    }
  }

  return <section className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-[#111a25]">
    <div className="flex items-start gap-3 p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-400/10 text-sky-300"><Eye size={18}/></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><p className="text-[13px] font-semibold">Image understanding</p>{configured && <CheckCircle2 size={13} className="text-emerald-400"/>}</div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Gemini interprets screenshots and sends a description to your text-only coding model.
          {configured ? ` Current model: ${currentModel}.` : " Connect a Gemini API key to choose a vision model."}
        </p>
      </div>
      <button type="button" onClick={() => setExpanded(!expanded)} className="rounded-lg border px-3 py-1.5 text-[11px]">{configured ? "Change" : "Set up"}</button>
    </div>
    {expanded && <div className="space-y-3 border-t border-white/10 p-4">
      <label className="block text-[11px] font-medium">Gemini API key {configured && <span className="font-normal text-muted-foreground">(leave blank to keep existing)</span>}
        <input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)}
          placeholder={configured ? "Enter a replacement API key" : "Paste your Google AI Studio API key"} className="mt-1.5 h-9 w-full rounded-lg border bg-background px-3 text-xs"/>
      </label>
      <div className="flex items-center gap-2">
        <button type="button" disabled={busy || !key.trim()} onClick={() => void saveKey()} className="rounded-lg bg-sky-500 px-3 py-2 text-[11px] font-semibold text-slate-950 disabled:opacity-40">Save vision key</button>
        {configured && <button type="button" disabled={busy} onClick={() => void saveKey(true)} className="rounded-lg border px-3 py-2 text-[11px]">Disconnect</button>}
      </div>
      {configured && <div className="space-y-2 rounded-lg border border-white/10 bg-black/10 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold">Vision model</span>
          <button type="button" disabled={loadingModels || busy} onClick={() => void refreshModels()} className="inline-flex items-center gap-1 text-[11px] text-sky-300 disabled:opacity-50"><RefreshCw size={12} className={loadingModels ? "animate-spin" : ""} />{loadingModels ? "Loading…" : "Refresh models"}</button>
        </div>
        <p className="text-[10px] leading-5 text-muted-foreground">Models are requested from Google using your API key. Google may still restrict generation for individual models. Free-tier limits and possible charges depend on your account.</p>
        {models.length > 0 && <>
          <label htmlFor="anchr-vision-model" className="block text-[11px] text-muted-foreground">Choose a model</label>
          <select id="anchr-vision-model" value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
            className="h-9 w-full rounded-lg border bg-background px-2 text-[11px]">
            {models.map(item => <option key={item.id} value={item.id}>{item.label === item.id ? item.id : `${item.label} (${item.id})`}</option>)}
          </select>
          <button type="button" disabled={busy || loadingModels || selectedModel === currentModel}
            onClick={() => void saveModel()} className="rounded-lg border border-sky-400/35 px-3 py-2 text-[11px] font-semibold text-sky-300 disabled:opacity-40">
            Use selected model
          </button>
        </>}
      </div>}
      <p className="flex gap-1.5 text-[10px] leading-5 text-muted-foreground"><LockKeyhole className="mt-0.5 shrink-0" size={12}/>Your API key is encrypted locally with Windows secure storage. Images are sent to Gemini only after you attach and submit them.</p>
      {error && <p role="alert" className="text-[11px] text-rose-300">{error}</p>}
      {status && <p role="status" className="text-[11px] text-emerald-300">{status}</p>}
      <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="block text-[11px] text-sky-300 underline">Manage Gemini API keys</a>
    </div>}
  </section>;
}
