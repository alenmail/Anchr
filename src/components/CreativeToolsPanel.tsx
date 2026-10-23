import { useEffect, useState } from "react";
import { Box, Clapperboard, Figma, Image, RefreshCw, ExternalLink, Check, Sparkles } from "lucide-react";
import { desktop } from "@/lib/desktop";

const inp="mt-1.5 h-9 w-full rounded-lg border border-white/10 bg-[#0c141d] px-3 text-xs outline-none focus:border-sky-500/60";
const btn="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/[.035] px-3 py-2 text-xs font-medium hover:bg-white/[.08] disabled:opacity-40";
type Frame={id:string;name:string};

export default function CreativeToolsPanel(){
  const [runtime,setRuntime]=useState<{available:boolean;runtimeBundled:boolean;outputDirectory:string}|null>(null);
  const [modelName,setModelName]=useState("Stylized creature");
  const [archetype,setArchetype]=useState<"creature"|"character"|"humanoid"|"vehicle"|"building"|"architecture"|"prop">("creature");
  const [style,setStyle]=useState<"stylized"|"realistic"|"lowpoly">("stylized");
  const [animation,setAnimation]=useState<"none"|"idle"|"walk"|"run"|"attack">("idle");
  const [modelBusy,setModelBusy]=useState(false);
  const [modelOutput,setModelOutput]=useState<{preview:string;model:string;native:string;report:{objects:number}}|null>(null);
  const [figmaActive,setFigmaActive]=useState(false);
  const [figmaKey,setFigmaKey]=useState("");
  const [figmaUrl,setFigmaUrl]=useState("");
  const [frames,setFrames]=useState<Frame[]>([]);
  const [frameId,setFrameId]=useState("");
  const [figmaResult,setFigmaResult]=useState<{code:string;file:string;convertedNodes:number;unconvertedVisuals:string[]}|null>(null);
  const [figmaBusy,setFigmaBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  useEffect(()=>{
    void Promise.all([desktop.blenderStatus(),desktop.figmaConfigured()])
      .then(([blender,connected])=>{setRuntime(blender);setFigmaActive(connected);})
      .catch(cause=>setError(cause instanceof Error?cause.message:"Unable to initialize creative tools"));
  },[]);
  const clear=()=>{setError("");setMessage("");};

  async function makeModel(){
    clear();setModelBusy(true);
    try{
      const output=await desktop.blenderCreateModel({name:modelName,archetype,style,animation,detail:3});
      setModelOutput(output);
      setMessage("Model exported. Review the preview, then import the GLB through Roblox Studio > File > Import 3D.");
    }catch(e){setError(e instanceof Error?e.message:"Blender generation failed");}
    finally{setModelBusy(false);}
  }
  async function connectFigma(){
    clear();setFigmaBusy(true);
    try{const ok=await desktop.setFigmaToken(figmaKey);setFigmaActive(ok);setFigmaKey("");setMessage(ok?"Figma token saved in OS secure storage.":"Figma disconnected.");}
    catch(e){setError(e instanceof Error?e.message:"Could not connect Figma");}
    finally{setFigmaBusy(false);}
  }
  async function browseFigma(){
    clear();setFigmaBusy(true);
    try{const result=await desktop.figmaFrames(figmaUrl);setFrames(result.frames);setFrameId(result.selected||result.frames[0]?.id||"");setMessage(result.frames.length+" frames found");}
    catch(e){setError(e instanceof Error?e.message:"Failed to read Figma frames");}
    finally{setFigmaBusy(false);}
  }
  async function importFigma(){
    clear();setFigmaBusy(true);
    try{const result=await desktop.figmaGenerateUi(figmaUrl,frameId);setFigmaResult(result);setMessage("Generated "+result.convertedNodes+" Roblox UI objects. Preview and apply only if correct.");}
    catch(e){setError(e instanceof Error?e.message:"Could not generate Roblox UI");}
    finally{setFigmaBusy(false);}
  }
  async function applyFigma(){
    if(!figmaResult||!window.confirm("Insert this generated UI into the currently connected Roblox Studio place? Review it first; complex vectors use placeholders."))return;
    clear();setFigmaBusy(true);
    try{
      const response=await desktop.figmaApplyUi(figmaResult.code) as {isError?:boolean;content?:Array<{text?:string}>};
      if(response?.isError)throw Error(response.content?.map(x=>x.text).join("\n")||"Studio rejected the UI");
      setMessage("Roblox UI added to StarterGui in the connected place.");
    }catch(e){setError(e instanceof Error?e.message:"Studio import failed");}
    finally{setFigmaBusy(false);}
  }
  return <div className="mx-auto w-full max-w-lg space-y-5 px-4 py-6 @xl:px-6">
    <header className="space-y-1"><div className="flex items-center gap-2"><Sparkles size={17} className="text-sky-300"/><h3 className="text-lg font-semibold tracking-tight">Creative Tools</h3></div>
      <p className="text-[11px] leading-5 text-muted-foreground">Local modeling, basic animation, Figma UI import and bundled icons. No paid add-ons required.</p>
    </header>
    <section className="space-y-3 rounded-xl border border-white/10 bg-white/[.025] p-4">
      <div className="flex items-center justify-between gap-2"><h4 className="flex items-center gap-2 text-[13px] font-semibold"><Box size={16}/> Blender modeling</h4>
        <span className={"text-[10px] "+(runtime?.available?"text-emerald-400":"text-amber-300")}>{runtime?.available?"Local runtime ready":"Runtime not found"}</span>
      </div>
      <p className="text-[11px] leading-5 text-muted-foreground">Generates a textured procedural GLB, editable .blend file and preview. For more complex models, ask Anchr to call its Blender MCP tools.</p>
      <label className="block text-[11px]">Model name<input className={inp} value={modelName} onChange={e=>setModelName(e.target.value)} maxLength={70}/></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px]">Archetype<select className={inp} value={archetype} onChange={e=>setArchetype(e.target.value as typeof archetype)}>
          {["creature","character","humanoid","vehicle","building","architecture","prop"].map(x=><option key={x} value={x}>{x}</option>)}
        </select></label>
        <label className="text-[11px]">Style<select className={inp} value={style} onChange={e=>setStyle(e.target.value as typeof style)}>
          {["stylized","realistic","lowpoly"].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <label className="text-[11px]">Motion preset<select className={inp} value={animation} onChange={e=>setAnimation(e.target.value as typeof animation)}>
          {["none","idle","walk","run","attack"].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
      </div>
      <button type="button" disabled={!runtime?.available||modelBusy} className={btn} onClick={()=>void makeModel()}>{modelBusy?<RefreshCw size={13} className="animate-spin"/>:<Clapperboard size={13}/>} {modelBusy?"Generating locally…":"Generate and export model"}</button>
      {modelOutput&&<div className="space-y-2 rounded-lg bg-[#101b26] p-3 text-[11px]">
        <p className="font-semibold text-emerald-300">{modelOutput.report.objects} Blender objects exported</p>
        <div className="flex flex-wrap gap-2"><button className={btn} type="button" onClick={()=>void desktop.openCreativeFile(modelOutput.preview)}><Image size={13}/> Open preview</button>
          <button className={btn} type="button" onClick={()=>void desktop.openCreativeFile(modelOutput.model)}>Open GLB</button></div>
        <p className="text-[10px] text-muted-foreground">Use Roblox Studio's File → Import 3D for the GLB. Rigging and animation retargeting may need manual adjustment.</p>
      </div>}
    </section>
    <section className="space-y-3 rounded-xl border border-white/10 bg-white/[.025] p-4">
      <div className="flex justify-between gap-2"><h4 className="flex items-center gap-2 text-[13px] font-semibold"><Figma size={16}/> Figma → Roblox UI</h4><span className="text-[10px] text-slate-400">{figmaActive?"Connected":"Not connected"}</span></div>
      <p className="text-[11px] leading-5 text-muted-foreground">Import frames, text, positions and solid fills from designs you can access. Image/vector layers need asset IDs uploaded to Roblox.</p>
      <label className="block text-[11px]">Figma personal access token (scope: file_content:read)
        <input className={inp} type="password" autoComplete="off" value={figmaKey} onChange={e=>setFigmaKey(e.target.value)} placeholder={figmaActive?"Replace existing token":"Paste token from Figma Settings"}/>
      </label>
      <div className="flex items-center gap-2"><button type="button" className={btn} disabled={figmaBusy||!figmaKey.trim()} onClick={()=>void connectFigma()}><Check size={13}/> {figmaActive?"Replace token":"Connect Figma"}</button>
        {figmaActive&&<button type="button" className={btn} onClick={()=>void desktop.setFigmaToken("").then(()=>{setFigmaActive(false);setFrames([]);setFigmaResult(null);})}>Disconnect</button>}
      </div>
      {figmaActive&&<>
        <label className="block text-[11px]">Figma design URL<input className={inp} type="url" value={figmaUrl} onChange={e=>setFigmaUrl(e.target.value)} placeholder="https://www.figma.com/design/..."/></label>
        <button type="button" disabled={figmaBusy||!figmaUrl.trim()} onClick={()=>void browseFigma()} className={btn}>Find frames</button>
        {frames.length>0&&<>
          <label className="block text-[11px]">Frame<select className={inp} value={frameId} onChange={e=>setFrameId(e.target.value)}>{frames.map(f=><option value={f.id} key={f.id}>{f.name} ({f.id})</option>)}</select></label>
          <button type="button" className={btn} disabled={figmaBusy} onClick={()=>void importFigma()}>Generate Roblox UI</button>
        </>}
        {figmaResult&&<div className="space-y-2 rounded-lg bg-[#101b26] p-3 text-[11px]">
          <p className="text-emerald-300">{figmaResult.convertedNodes} UI elements generated</p>
          {figmaResult.unconvertedVisuals.length>0&&<p className="text-amber-200">{figmaResult.unconvertedVisuals.length} vector/image assets still need Roblox asset IDs.</p>}
          <textarea aria-label="Generated Luau preview" readOnly value={figmaResult.code} className="h-32 w-full rounded-lg border border-white/10 bg-black/30 p-2 font-mono text-[10px]"/>
          <div className="flex flex-wrap gap-2"><button type="button" className={btn} onClick={()=>void navigator.clipboard.writeText(figmaResult.code)}>Copy Luau</button>
            <button type="button" className={btn} disabled={figmaBusy} onClick={()=>void applyFigma()}>Apply to connected Studio</button></div>
        </div>}
      </>}
    </section>
    <section className="space-y-2 rounded-xl border border-white/10 bg-white/[.025] p-4">
      <h4 className="flex items-center gap-2 text-[13px] font-semibold"><Image size={16}/> Built-in icon pack</h4>
      <p className="text-[11px] leading-5 text-muted-foreground">24 transparent icons included locally (no subscription). Open the pack and upload desired PNGs as Roblox Image assets to use them in game UI.</p>
      <button type="button" className={btn} onClick={()=>void desktop.openIconFolder().catch(e=>setError(e instanceof Error?e.message:"Icon pack unavailable"))}><ExternalLink size={13}/> Open bundled icons</button>
    </section>
    {error&&<p role="alert" className="rounded-lg border border-rose-500/20 p-3 text-[11px] text-rose-300">{error}</p>}
    {message&&<p role="status" className="rounded-lg border border-emerald-500/15 p-3 text-[11px] text-emerald-300">{message}</p>}
    <p className="text-[10px] leading-5 text-muted-foreground">Quality note: these tools improve the modeling pipeline but cannot promise photorealistic text-to-3D or studio-ready motion capture. Complex UI vectors and Roblox Image uploads still require review and creator authorization.</p>
  </div>;
}
