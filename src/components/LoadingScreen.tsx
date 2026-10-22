import { useState } from "react";
import { RefreshCw, Copy, CircleHelp } from "lucide-react";
import logo from "@/assets/anchr-logo.webp";

export type StartupAnimation = "sparkles" | "dots" | "blocks";
export interface StartupProgress {
  step: 1 | 2 | 3;
  label: string;
  progress?: number;
  meta?: string;
}
interface LoadingScreenProps {
  message?: string;
  detail?: string;
  detailPath?: string;
  technicalDetail?: string;
  animation?: StartupAnimation;
  startup?: StartupProgress;
  error?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
}
export default function LoadingScreen({
  message = "Initializing your workspace",
  detail,
  detailPath,
  technicalDetail,
  startup,
  error,
  onRetry,
  retrying,
}: LoadingScreenProps) {
  const [copied, setCopied] = useState(false);
  const progress = startup?.progress === undefined ? null : Math.round(Math.max(0, Math.min(1, startup.progress)) * 100);
  return (
    <div className="anchr-startup relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10" role={error ? "alert" : "status"}>
      <div className="anchr-startup-grid" aria-hidden="true" />
      <div className="relative flex w-full max-w-sm flex-col items-center text-center">
        <span className="mb-8 text-[10px] font-semibold uppercase tracking-[.38em] text-sky-300/70">Anchr / Studio</span>
        <div className="anchr-beacon" aria-hidden="true">
          <div className="anchr-beacon-orbit anchr-beacon-orbit--outer" />
          <div className="anchr-beacon-orbit anchr-beacon-orbit--inner" />
          <div className="anchr-beacon-core"><img src={logo} alt="" className="h-20 w-20 rounded-[21px]" /></div>
          <span className="anchr-beacon-node" />
        </div>
        <h1 className="mt-9 font-display text-2xl font-semibold tracking-tight text-foreground">{error ? "Connection interrupted" : message}</h1>
        <p className="mt-2 max-w-xs text-[12px] leading-relaxed text-muted-foreground">{detail ?? (error ? "The local engine could not start. Check the details below." : "Preparing the tools that connect your ideas to Studio.")}</p>
        {detailPath && <code className="mt-3 max-w-full select-all break-all rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px]">{detailPath}</code>}
        {error ? (
          <div className="mt-7 flex w-full flex-col items-center gap-3">
            {onRetry && <button type="button" onClick={onRetry} disabled={retrying} className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"><RefreshCw size={14} className={retrying ? "animate-spin" : ""} />Retry connection</button>}
            {technicalDetail && <details className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-left text-xs"><summary className="cursor-pointer">Technical details</summary><pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">{technicalDetail}</pre><button type="button" onClick={async () => { await navigator.clipboard.writeText(technicalDetail); setCopied(true); }} className="mt-2 inline-flex items-center gap-1 text-sky-300"><Copy size={12} />{copied ? "Copied" : "Copy details"}</button></details>}
            <a href="https://github.com/alenmail/Anchr/issues" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"><CircleHelp size={12} /> Report an issue</a>
          </div>
        ) : (
          <div className="mt-8 w-full max-w-[260px]">
            <div className="mb-2 flex justify-between text-[10px] uppercase tracking-[.13em] text-slate-400">
              <span>{startup?.label ?? "Starting engine"}</span><span>{startup ? `${startup.step}/3` : "ACTIVE"}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className={progress === null ? "anchr-startup-progress-indeterminate" : "h-full rounded-full bg-sky-400 transition-all"} style={progress === null ? undefined : { width: `${progress}%` }} /></div>
            {startup?.meta && <div className="mt-2 text-right font-mono text-[10px] text-muted-foreground">{startup.meta}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
