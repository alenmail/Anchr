import { useState } from "react";
import { ArrowRight, Check, ChevronLeft, Code2, Gamepad2, Pin, PlugZap, Sparkles } from "lucide-react";
import logo from "@/assets/anchr-logo.webp";

const steps = [
  { label: "WELCOME", title: "Build with Anchr.", detail: "Your AI companion for Roblox Studio. Inspect your game, write and refine Luau scripts, debug issues and playtest from one focused workspace.", icon: Sparkles, points: ["One workspace for scripts and Studio", "Direct access to your game hierarchy", "AI-assisted iteration from idea to playtest"] },
  { label: "STUDIO CONNECTION", title: "Connect your place.", detail: "Open Roblox Studio and your game. The Anchr Studio plugin bridges the desktop app and Studio.", icon: Gamepad2, points: ["Open Roblox Studio and load a place", "Restart Studio if the plugin was just installed", "Use the Anchr plugin and choose the connected place"] },
  { label: "AI PROVIDER", title: "Bring your own model.", detail: "Choose an AI provider in Settings. For a compatible service, enter its API base URL and key, fetch the model list, then select the model you want.", icon: PlugZap, points: ["Settings → Providers → OpenAI-compatible API", "Fetch available models from your endpoint", "Select a model in the chat composer"] },
  { label: "WORKFLOW", title: "Create. Inspect. Test.", detail: "Describe what you're building and Anchr uses the connected tools to interact with your Roblox Studio project.", icon: Code2, points: ["Ask Anchr to inspect Workspace or a script", "Review changes before destructive operations", "Use Playtest and Explorer to iterate"] },
];

export default function FirstLaunchGuide({ onFinish }: { onFinish: () => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");
  const current = steps[step];
  const Icon = current.icon;

  async function finish() {
    setSaving(true);
    setProblem("");
    try { await onFinish(); }
    catch (cause) { setProblem(cause instanceof Error ? cause.message : "Couldn't save setup progress."); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#060a10]/90 px-5 py-6 backdrop-blur-xl" role="dialog" aria-modal="true" aria-labelledby="anchr-welcome-title">
      <section className="anchr-guide-enter relative w-full max-w-[570px] overflow-hidden rounded-[24px] border border-white/10 bg-[#111821] p-7 shadow-[0_30px_100px_rgba(0,0,0,.6)] sm:p-9">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3"><img src={logo} alt="" className="h-10 w-10 rounded-[11px]" />
            <div><div className="text-sm font-semibold tracking-[.02em]">Anchr</div><p className="mt-0.5 text-[10px] tracking-wide text-slate-400">A short guide to get started</p></div>
          </div>
          <span className="font-mono text-[11px] text-slate-500">0{step+1} / 04</span>
        </header>
        <div className="my-8 h-px bg-white/10" />
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-300/15 bg-[#172a3a] text-sky-300"><Icon size={21} strokeWidth={1.6}/></div>
        <p className="text-[10px] font-semibold tracking-[.17em] text-sky-300">{current.label}</p>
        <h2 id="anchr-welcome-title" className="mt-2 text-[28px] font-semibold tracking-[-.035em] text-white">{current.title}</h2>
        <p className="mt-3 max-w-[440px] text-[13px] leading-[1.8] text-slate-400">{current.detail}</p>
        <div className="mt-7 space-y-3">
          {current.points.map((point) => <div key={point} className="flex items-start gap-3 text-[12px] text-slate-300"><Check size={14} className="mt-0.5 shrink-0 text-sky-300" /><span>{point}</span></div>)}
        </div>
        <div className="mt-10 flex items-center gap-1.5">{steps.map((item, index) => <div key={item.label} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${index<=step?"bg-sky-400":"bg-white/10"}`}/>)}</div>
        {problem && <p role="alert" className="mt-3 text-xs text-rose-300">{problem}</p>}
        <footer className="mt-5 flex items-center justify-between">
          <button type="button" disabled={saving} onClick={() => step > 0 ? setStep(step-1) : void finish()}
            className="flex items-center gap-1 text-[12px] text-slate-400 hover:text-white disabled:opacity-50">{step ? <><ChevronLeft size={14}/>Back</> : "Skip introduction"}</button>
          <button type="button" disabled={saving} onClick={() => step < steps.length-1 ? setStep(step+1) : void finish()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#eaf2fa] px-5 py-2.5 text-[12px] font-semibold text-[#101a25] transition-all duration-200 hover:bg-white active:scale-[.98] disabled:opacity-50">{step === steps.length-1 ? "Open Anchr" : "Continue"}<ArrowRight size={14}/></button>
        </footer>
      </section>
    </div>
  );
}
