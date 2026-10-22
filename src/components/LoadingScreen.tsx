import { useState } from "react";
import { ArrowRight, Copy, RotateCcw } from "lucide-react";
import mark from "@/assets/anchr-mark.svg";

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
  message = "Preparing your workspace",
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
  return <div className="anchr-launch fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-5 py-10" role={error ? "alert" : "status"}>
    <div className="anchr-launch-content flex w-full max-w-sm flex-col items-center text-center">
      <img src={mark} alt="" aria-hidden="true" className="anchr-launch-mark h-[110px] w-[110px]" />
      <h1 className="mt-9 font-display text-[29px] font-semibold tracking-[-.04em] text-[#f6f9ff]">Anchr</h1>
      <p className="mt-2 text-[12px] font-medium text-slate-300">{error ? "Unable to start" : message}</p>
      <p className="mt-1 max-w-[300px] text-[11px] leading-6 text-slate-500">
        {detail ?? (error ? "Check the connection details and try again." : "Preparing the connection to your Roblox Studio workspace.")}
      </p>
      {detailPath && <code className="mt-3 max-w-full select-all break-all rounded-lg bg-slate-800/50 px-3 py-2 text-[11px] text-slate-300">{detailPath}</code>}
      {error ? <div className="mt-7 flex w-full flex-col items-center gap-4">
        {onRetry && <button type="button" onClick={onRetry} disabled={retrying} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-white disabled:opacity-50"><RotateCcw size={14} className={retrying ? "animate-spin" : ""}/>Try again<ArrowRight size={13}/></button>}
        {technicalDetail && <details className="w-full rounded-xl border border-white/10 bg-white/[.025] p-3 text-left text-xs">
          <summary className="cursor-pointer text-slate-300">Technical details</summary>
          <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap break-all text-[11px] text-slate-400">{technicalDetail}</pre>
          <button className="mt-2 inline-flex items-center gap-1.5 text-slate-300" type="button" onClick={async()=>{await navigator.clipboard.writeText(technicalDetail);setCopied(true)}}><Copy size={12}/>{copied?"Copied":"Copy details"}</button>
        </details>}
      </div> : <div className="mt-9 w-full max-w-[215px]">
        <div className="h-[2px] overflow-hidden rounded-full bg-white/10">
          <div className={progress === null ? "anchr-launch-progress-active" : "h-full rounded-full bg-[#a9c9dc] transition-[width] duration-300"} style={progress === null ? undefined : {width: progress+"%"}}/>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-[10px] tracking-wide text-slate-500"><span>{startup?.label ?? "Starting services"}</span><span>{startup ? startup.step+" / 3" : " "}</span></div>
        {startup?.meta && <span className="mt-2 block text-right font-mono text-[10px] text-slate-500">{startup.meta}</span>}
      </div>}
    </div>
  </div>;
}
