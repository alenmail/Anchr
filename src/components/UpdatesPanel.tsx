import { useEffect, useState } from "react";
import { Download, RefreshCw, ExternalLink, ShieldCheck } from "lucide-react";
import { desktop } from "@/lib/desktop";
import type { UpdateInfo } from "@/types/desktop";

export default function UpdatesPanel(){
  const [version,setVersion]=useState("");
  const [next,setNext]=useState<UpdateInfo|null>(null);
  const [status,setStatus]=useState("Ready to check");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{void desktop.getVersion().then(setVersion).catch(()=>undefined)},[]);
  async function check(){
    setBusy(true);setStatus("Checking GitHub Releases…");
    try{
      const update=await desktop.checkForUpdate();setNext(update);
      setStatus(update?"Version "+update.version+" is available.":"Anchr is up to date.");
    }catch(e){setStatus(e instanceof Error?e.message:"Couldn't check releases");}
    finally{setBusy(false);}
  }
  async function install(){
    setBusy(true);setStatus("Downloading signed release metadata and installer. Anchr will restart when ready…");
    try{await desktop.installUpdate();}
    catch(e){setStatus(e instanceof Error?e.message:"Automatic installation failed");setBusy(false);}
  }
  return <div className="mx-auto w-full max-w-md space-y-5 px-5 py-7">
    <header><h3 className="text-lg font-semibold tracking-tight">Updates</h3><p className="mt-1 text-xs text-muted-foreground">Manage Anchr from inside the app. No need to search for installer downloads.</p></header>
    <div className="rounded-xl border border-white/10 bg-white/[.025] p-4">
      <div className="flex items-center justify-between"><span className="text-[11px] text-muted-foreground">Installed version</span><span className="font-mono text-xs font-semibold">{version||"Checking…"}</span></div>
      <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-300"><ShieldCheck size={15} className="text-sky-300"/> Updates are fetched from Anchr's GitHub beta release channel.</div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={()=>void check()} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-xs font-medium disabled:opacity-50">
          <RefreshCw size={13} className={busy?"animate-spin":""}/> Check for updates
        </button>
        {next&&<button type="button" disabled={busy} onClick={()=>void install()} className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">
          <Download size={13}/> Install {next.version} and restart
        </button>}
      </div>
      <p role="status" className="mt-4 text-[11px] leading-5 text-muted-foreground">{status}</p>
    </div>
    <button type="button" onClick={()=>void desktop.openUrl("https://github.com/alenmail/Anchr/releases")}
      className="inline-flex items-center gap-2 text-[11px] text-sky-300"><ExternalLink size={13}/> View release history and change notes</button>
    <p className="text-[10px] leading-5 text-muted-foreground">The Windows update is installed only after you select Install. A code-signed installer is preferable for production; current development builds may trigger Windows security warnings.</p>
  </div>;
}
