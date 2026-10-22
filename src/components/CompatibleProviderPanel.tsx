import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, CheckCircle2, PlugZap } from "lucide-react";
import { useOpenCodeClient } from "@/providers/OpenCodeClientProvider";
import { loadConfig, patchConfig } from "@/lib/config";
import { qk } from "@/lib/queryKeys";

const PROVIDER_ID = "anchr-compatible";

export default function CompatibleProviderPanel() {
  const { client } = useOpenCodeClient();
  const queryClient = useQueryClient();
  const { data: config } = useQuery({ queryKey: qk.config, queryFn: loadConfig });
  const [expanded, setExpanded] = useState(false);
  const [baseURL, setBaseURL] = useState("");
  const [modelId, setModelId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!config?.customEndpoint) return;
    setBaseURL(config.customEndpoint.baseURL);
    setModelId(config.customEndpoint.modelId);
  }, [config?.customEndpoint]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    const endpoint = baseURL.trim().replace(/\/+$/, "");
    const model = modelId.trim();
    try {
      const parsed = new URL(endpoint);
      const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
      if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocal)) {
        throw new Error("Use HTTPS, or HTTP on localhost for a local model server.");
      }
      if (!model || model.length > 160) throw new Error("Enter the exact model ID used by your endpoint.");
      if (!client) throw new Error("The Anchr AI engine is not ready.");
      setBusy(true);
      await patchConfig({ customEndpoint: { baseURL: endpoint, modelId: model } });
      await client.auth.set({
        providerID: PROVIDER_ID,
        auth: { type: "api", key: apiKey.trim() || "local" },
      }, { throwOnError: true });
      await client.instance.dispose({}, { throwOnError: true });
      await queryClient.invalidateQueries({ queryKey: qk.providers });
      await queryClient.invalidateQueries({ queryKey: qk.config });
      setApiKey("");
      setStatus("Endpoint saved. Select your model below the chat composer.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not configure this endpoint.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-5 rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/[.12] via-[#122035] to-[#0e1726] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300"><PlugZap size={18} /></div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold">OpenAI-compatible API</div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Connect your own model endpoint using a base URL, model ID, and optional API key. Works with compatible cloud and local servers.</p>
        </div>
        <button type="button" onClick={() => setExpanded((value) => !value)}
          className="app-no-drag shrink-0 rounded-lg bg-sky-500 px-3 py-1.5 text-[11px] font-semibold text-slate-950">
          {expanded ? "Close" : config?.customEndpoint ? "Edit" : "Set up"}
        </button>
      </div>
      {config?.customEndpoint && !expanded && <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-300"><CheckCircle2 size={13} /> Configured: {config.customEndpoint.modelId}</div>}
      {expanded && (
        <form onSubmit={(event) => void save(event)} className="mt-4 space-y-3 border-t border-white/10 pt-4">
          <label className="block text-[11px] text-slate-300">Base URL
            <input required type="url" value={baseURL} onChange={(event) => setBaseURL(event.target.value)}
              placeholder="https://api.example.com/v1" className="mt-1.5 h-9 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 text-xs text-white placeholder:text-slate-600" />
          </label>
          <label className="block text-[11px] text-slate-300">Model ID
            <input required type="text" value={modelId} onChange={(event) => setModelId(event.target.value)}
              placeholder="your-model-id" className="mt-1.5 h-9 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 text-xs text-white placeholder:text-slate-600" />
          </label>
          <label className="block text-[11px] text-slate-300">API key (optional for local servers)
            <input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-…" className="mt-1.5 h-9 w-full rounded-lg border border-white/15 bg-slate-950/70 px-3 text-xs text-white placeholder:text-slate-600" />
          </label>
          <p className="text-[10px] leading-relaxed text-slate-500">Anchr saves your endpoint and model locally. The API key is stored by the local AI engine, not in the Anchr settings file. Your provider receives the prompts you send.</p>
          {error && <p role="alert" className="text-[11px] text-red-300">{error}</p>}
          {status && <p role="status" className="text-[11px] text-emerald-300">{status}</p>}
          <button disabled={busy} type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-500 px-4 text-[11px] font-semibold text-slate-950 disabled:opacity-60">{busy ? "Saving..." : "Connect endpoint"}<ArrowUpRight size={13} /></button>
        </form>
      )}
    </div>
  );
}
