import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, LoaderCircle, RefreshCw } from "lucide-react";
import { useOpenCodeClient } from "@/providers/OpenCodeClientProvider";
import { loadConfig } from "@/lib/config";
import { desktop } from "@/lib/desktop";
import { qk } from "@/lib/queryKeys";

type RemoteModel = { id: string; name: string };

export default function CompatibleProviderPanel() {
  const { client } = useOpenCodeClient();
  const queryClient = useQueryClient();
  const { data: config } = useQuery({ queryKey: qk.config, queryFn: loadConfig });
  const [expanded, setExpanded] = useState(false);
  const [baseURL, setBaseURL] = useState("");
  const [modelId, setModelId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<RemoteModel[]>([]);
  const [filter, setFilter] = useState("");
  const [loadingModels, setLoadingModels] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!config?.customEndpoint) return;
    setBaseURL(config.customEndpoint.baseURL);
    setModelId(config.customEndpoint.modelId);
  }, [config?.customEndpoint?.baseURL, config?.customEndpoint?.modelId]);

  const listed = useMemo(() => models.filter((item) => (item.id + " " + item.name).toLowerCase().includes(filter.toLowerCase())), [models, filter]);

  async function discover() {
    setError("");
    setStatus("");
    setLoadingModels(true);
    try {
      const list = await desktop.discoverCompatibleModels(baseURL.trim(), apiKey.trim());
      setModels(list);
      setModelId((current) => list.some((item) => item.id === current) ? current : list[0].id);
      setStatus(`${list.length} models available. Choose the one you want to use.`);
    } catch (cause) {
      setModels([]);
      setError(cause instanceof Error ? cause.message : "Couldn't load the model list. Check your URL and key.");
    } finally { setLoadingModels(false); }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const endpoint = baseURL.trim().replace(/\/+$/, "");
    try {
      const parsed = new URL(endpoint);
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
      if (parsed.username || parsed.password || (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)))
        throw new Error("Use HTTPS, or HTTP on localhost for local AI.");
      if (!modelId.trim()) throw new Error("Fetch and select a model first.");
      if (!client) throw new Error("The local AI engine is not ready.");
      setBusy(true);
      await desktop.patchConfig({ customEndpoint: { baseURL: endpoint, modelId: modelId.trim() } });
      if (apiKey.trim()) {
        await client.auth.set({ providerID: "anchr-compatible", auth: { type: "api", key: apiKey.trim() } }, { throwOnError: true });
      } else if (!config?.customEndpoint) {
        // Local OpenAI-compatible servers usually don't require credentials.
        await client.auth.set({ providerID: "anchr-compatible", auth: { type: "api", key: "local" } }, { throwOnError: true });
      }
      await client.instance.dispose({}, { throwOnError: true });
      await queryClient.invalidateQueries({ queryKey: qk.config });
      await queryClient.invalidateQueries({ queryKey: qk.providers });
      setApiKey("");
      setStatus("Connected. Select your model in the chat composer.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't connect to the endpoint.");
    } finally { setBusy(false); }
  }

  return <section className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#121c28]">
    <div className="flex items-center gap-3 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#1c2c3a] font-mono text-sm font-semibold text-slate-200">API</div>
      <div className="min-w-0 flex-1"><h5 className="text-[13px] font-semibold">OpenAI-compatible API</h5>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Use any supported model from your own endpoint.</p></div>
      <button type="button" onClick={() => setExpanded((value) => !value)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/15 px-3 py-2 text-[11px] font-semibold text-slate-100 transition-colors hover:bg-white/5">{config?.customEndpoint ? "Configure" : "Connect"}<ChevronDown size={13} className={`transition-transform ${expanded ? "rotate-180" : ""}`}/></button>
    </div>
    {config?.customEndpoint && !expanded && <p className="flex items-center gap-1.5 border-t border-white/[.07] px-4 py-2.5 text-[11px] text-emerald-300"><Check size={13}/>{config.customEndpoint.modelId}</p>}
    {expanded && <form onSubmit={(event) => void save(event)} className="space-y-4 border-t border-white/10 p-4">
      <label className="block text-[11px] font-medium text-slate-300">API base URL
        <input type="url" value={baseURL} onChange={(event) => {setBaseURL(event.target.value);setModels([]);}} required placeholder="https://api.example.com/v1" className="mt-1.5 h-10 w-full rounded-lg border border-white/15 bg-[#0b131e] px-3 text-xs text-white outline-none transition-colors focus:border-sky-400/70"/>
      </label>
      <label className="block text-[11px] font-medium text-slate-300">API key <span className="font-normal text-slate-500">(optional for local servers)</span>
        <input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Your API key" className="mt-1.5 h-10 w-full rounded-lg border border-white/15 bg-[#0b131e] px-3 text-xs text-white outline-none transition-colors focus:border-sky-400/70"/>
      </label>
      <div>
        <button type="button" onClick={() => void discover()} disabled={!baseURL.trim() || loadingModels} className="inline-flex items-center gap-2 rounded-lg border border-slate-600/60 px-3 py-2 text-[11px] font-semibold text-slate-100 transition-colors hover:bg-white/5 disabled:opacity-50">{loadingModels?<LoaderCircle size={13} className="animate-spin"/>:<RefreshCw size={13}/>} {loadingModels?"Fetching models…":models.length?"Refresh models":"Fetch available models"}</button>
      </div>
      {models.length>0 && <div className="space-y-2">
        <label htmlFor="compatible-model" className="block text-[11px] font-medium text-slate-300">Choose model <span className="font-normal text-slate-500">({models.length} available)</span></label>
        {models.length>12 && <input aria-label="Search models" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter models…" className="h-9 w-full rounded-lg border border-white/10 bg-[#0b131e] px-3 text-xs"/>}
        <select id="compatible-model" value={modelId} onChange={(event)=>setModelId(event.target.value)} className="w-full rounded-lg border border-white/15 bg-[#0b131e] px-3 py-2.5 text-xs text-slate-100 outline-none focus:border-sky-400/70">
          {listed.length===0 && <option value={modelId}>{modelId||"No matches"}</option>}
          {listed.map(item=><option key={item.id} value={item.id}>{item.name===item.id?item.id:`${item.name} — ${item.id}`}</option>)}
        </select>
      </div>}
      {!models.length && config?.customEndpoint && <p className="text-[11px] text-slate-400">Current model: <strong className="text-slate-200">{config.customEndpoint.modelId}</strong>. Fetch models to change it.</p>}
      {status && <p role="status" className="text-[11px] text-emerald-300">{status}</p>}
      {error && <p role="alert" className="text-[11px] text-rose-300">{error}</p>}
      <button type="submit" disabled={busy || !modelId.trim()} className="w-full rounded-xl bg-[#e9f1f8] px-4 py-2.5 text-[12px] font-semibold text-[#0d1722] transition-colors hover:bg-white disabled:opacity-40">{busy?"Saving…":"Save connection"}</button>
      <p className="text-[10px] leading-relaxed text-slate-500">Models are loaded directly from the endpoint’s /models API. Credentials are handled by the local AI engine. Your provider processes the requests you send.</p>
    </form>}
  </section>;
}
