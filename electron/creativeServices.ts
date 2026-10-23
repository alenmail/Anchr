import { app, shell } from "electron";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export interface BlenderPlan {
  name: string;
  archetype: "creature"|"character"|"humanoid"|"vehicle"|"building"|"architecture"|"prop";
  style?: "stylized"|"realistic"|"lowpoly";
  detail?: number;
  animation?: "none"|"idle"|"walk"|"run"|"attack";
  palette?: string[];
}
function paths(){
  const res=app.isPackaged?process.resourcesPath:join(process.cwd(),"vendor");
  return {
    executable:join(res,"blender-runtime","blender.exe"),
    worker:app.isPackaged
      ?join(res,"anchr-mcp","node_modules","anchr-blender-backend.py")
      :join(process.cwd(),"creative","blender_backend.py")
  };
}
export async function getBlenderStatus(){
  const p=paths();
  return {available:existsSync(p.executable)&&existsSync(p.worker),runtimeBundled:existsSync(p.executable),engine:"Blender (local, headless)",outputDirectory:join(homedir(),"Anchr","Creative","Models")};
}
export async function createBlenderModel(plan:BlenderPlan){
  const p=paths();
  if(!existsSync(p.executable)||!existsSync(p.worker))throw Error("The local Blender runtime is not installed with this build");
  if(!plan||typeof plan.name!=="string"||plan.name.length>70||!plan.name.trim())throw Error("Provide a model name (max 70 chars)");
  if(!["creature","character","humanoid","vehicle","building","architecture","prop"].includes(plan.archetype))throw Error("Choose an archetype");
  const spec={
    name:plan.name.trim(),archetype:plan.archetype,
    style:["stylized","realistic","lowpoly"].includes(plan.style||"")?plan.style:"stylized",
    detail:Math.max(1,Math.min(3,Number(plan.detail)||2)),
    animation:["none","idle","walk","run","attack"].includes(plan.animation||"")?plan.animation:"none",
    palette:plan.palette?.filter(x=>/^#[0-9a-f]{6}$/i.test(x)).slice(0,5),
  };
  const root=join(homedir(),"Anchr","Creative","Models");await mkdir(root,{recursive:true});
  const folder=await mkdtemp(join(root,"model-"));
  const specPath=join(folder,"spec.json");await writeFile(specPath,JSON.stringify(spec),"utf8");
  await new Promise<void>((resolve,reject)=>{
    const child=spawn(p.executable,["-b","--factory-startup","--disable-autoexec","--threads","2","--python",p.worker,"--",specPath,folder],
      {windowsHide:true,stdio:["ignore","pipe","pipe"]});
    let stderr="",exited=false;
    const t=setTimeout(()=>{if(!exited){child.kill();reject(Error("Blender took too long (180-second limit)"));}},180000);
    child.stdout.on("data",()=>undefined);
    child.stderr.on("data",b=>stderr=(stderr+b.toString()).slice(-2000));
    child.on("error",e=>{clearTimeout(t);exited=true;reject(e)});
    child.on("close",code=>{clearTimeout(t);exited=true;code===0?resolve():reject(Error("Blender failed: "+stderr.slice(-900)))});
  });
  const report=JSON.parse(await readFile(join(folder,"report.json"),"utf8")) as {objects:number;archetype:string;animation:string};
  return {folder,preview:join(folder,"preview.png"),model:join(folder,"model.glb"),native:join(folder,"model.blend"),report};
}
export async function openCreativeFile(path:string){
  if(typeof path!=="string"||path.length>2048)throw Error("Invalid path");
  const validRoots=[join(homedir(),"Anchr","Creative"),join(app.getPath("documents"),"Anchr","Creative")];
  const normalized=join(path,".");
  if(!validRoots.some(root=>normalized===root||normalized.startsWith(root+"\\")))throw Error("Can only open Anchr Creative output files");
  const error=await shell.openPath(path);
  if(error)throw Error(error);
}
export async function openIconFolder(){
  const dir=app.isPackaged?join(process.resourcesPath,"anchr-icons"):join(process.cwd(),"vendor","anchr-icons");
  if(!existsSync(dir))throw Error("Icon pack is missing from this installer");
  const error=await shell.openPath(dir);
  if(error)throw Error(error);
}
