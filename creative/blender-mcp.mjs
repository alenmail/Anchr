/** Anchr local Blender MCP; no cloud calls or arbitrary Python execution.
 * Run as a stdio child of OpenCode using the app-bundled Electron Node mode.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, readdir, stat } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

const blender = process.env.ANCHR_BLENDER_PATH || "";
const backend = process.env.ANCHR_BLENDER_BACKEND || join(import.meta.dirname, "anchr-blender-backend.py");
const outputs = resolve(process.env.ANCHR_CREATIVE_OUTPUT || join(homedir(), "Anchr", "Creative", "Models"));
mkdirSync(outputs, { recursive:true });
const inputSchema = {
  type:"object",
  properties:{
    name:{type:"string",description:"Short descriptive name"},
    concept:{type:"string",description:"Visual description and desired silhouette, proportions and character details, max 500 chars. e.g. tall gaunt pale creature with very long arms. Include explicit attributes from the user's request."},
    archetype:{type:"string",enum:["creature","character","humanoid","vehicle","building","architecture","prop"]},
    style:{type:"string",enum:["stylized","realistic","lowpoly"]},
    scale:{type:"number",minimum:0.4,maximum:3.0},
    detail:{type:"integer",minimum:1,maximum:3},
    palette:{type:"array",maxItems:5,items:{type:"string",pattern:"^#[0-9A-Fa-f]{6}$"}},
    animation:{type:"string",enum:["idle","walk","run","attack","none"]},
    seed:{type:"integer",minimum:0,maximum:100000}
  },
  required:["name","archetype"]
};
const server = new Server({name:"anchr-blender",version:"0.2.0"},{capabilities:{tools:{}}});
const definitions = [
 {name:"blender_status",description:"Check the bundled local Blender runtime and output folder. No paid API.",inputSchema:{type:"object",properties:{}}},
 {name:"blender_generate_model",description:"Generate a deterministic Blender model, material variant, PNG preview, GLB export, and native .blend file. Works locally and is more capable than Roblox primitives, but procedural quality cannot match trained text-to-3D services. Uses a constrained plan. Animations are simple articulated keyframes, not motion-captured or Roblox R15-compatible by default.",inputSchema},
 {name:"blender_generate_animation",description:"Generate a simple idle/walk/run/attack animated version of a humanoid/creature model; exports an animated GLB with basic pivot animation. Requires rig review and Roblox retargeting for R15.",inputSchema:{...inputSchema,required:["name","animation"]}},
 {name:"blender_list_outputs",description:"List the last 15 Anchr-generated mesh job folders, so the user can review previews and import GLB using Roblox Studio's 3D Importer.",inputSchema:{type:"object",properties:{}}}
];
server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:definitions}));
function safeText(value){return {content:[{type:"text",text:typeof value==="string"?value:JSON.stringify(value,null,2)}]};}
function fail(message){return {isError:true,content:[{type:"text",text:message}]};}
function validate(args){
 const a=args??{};
 if(typeof a.name!=="string"||!a.name.trim()||a.name.length>70) throw Error("Model name is required (max 70 characters)");
 const allowed=["creature","character","humanoid","vehicle","building","architecture","prop"];
 if(a.archetype && !allowed.includes(a.archetype)) throw Error("Unsupported archetype");
 if(a.animation && !["idle","walk","run","attack","none"].includes(a.animation)) throw Error("Unsupported motion preset");
 if(a.palette!==undefined && (!Array.isArray(a.palette)||a.palette.length>5||a.palette.some(v=>typeof v!=="string"||!/^#[0-9a-f]{6}$/i.test(v)))) throw Error("Invalid color palette");
 for (const [field,min,max] of [["scale",.4,3],["detail",1,3],["seed",0,100000]]) {
   if(a[field]!==undefined && (!Number.isFinite(a[field])||a[field]<min||a[field]>max)) throw Error("Invalid "+field);
 }
 const name=a.name.trim().slice(0,70);
 return {name,concept:typeof a.concept==="string"?a.concept.slice(0,500):"",archetype:a.archetype||"creature",style:["stylized","realistic","lowpoly"].includes(a.style)?a.style:"stylized",scale:a.scale||1,detail:a.detail||2,seed:a.seed??7,palette:a.palette?.length?a.palette:undefined,animation:a.animation||"idle"};
}
async function runBlender(plan){
 if(!blender||!existsSync(blender)) throw Error("Bundled Blender runtime not found. Reinstall Anchr from the complete v0.2 installer.");
 if(!existsSync(backend)) throw Error("Blender generator script not included");
 const folder=await mkdtemp(join(outputs,"model-"));
 const spec=join(folder,"spec.json");await writeFile(spec,JSON.stringify(plan));
 const args=["-b","--factory-startup","--disable-autoexec","--threads","2","--python",backend,"--",spec,folder];
 const result=await new Promise((ok,reject)=>{
   const child=spawn(blender,args,{windowsHide:true,stdio:["ignore","pipe","pipe"],env:{...process.env,BLENDER_USER_SCRIPTS:"",BLENDER_USER_CONFIG:join(folder,"config")}});
   let out="",err="",finished=false;
   const timer=setTimeout(()=>{if(!finished){child.kill();reject(Error("Blender generation exceeded 180 seconds"));}},180000);
   child.stdout.on("data",b=>out=(out+b.toString()).slice(-8000));
   child.stderr.on("data",b=>err=(err+b.toString()).slice(-8000));
   child.on("error",e=>{clearTimeout(timer);finished=true;reject(e)});
   child.on("close",code=>{clearTimeout(timer);finished=true;code===0?ok(out):reject(Error("Blender exited with "+code+": "+err.slice(-1200)+" "+out.slice(-800)))});
 });
 const report=JSON.parse(await readFile(join(folder,"report.json"),"utf8"));
 return {outputFolder:folder,model:join(folder,"model.glb"),blend:join(folder,"model.blend"),preview:join(folder,"preview.png"),report,
 instructions:"Open Roblox Studio > Avatar or Home > Import 3D and choose model.glb. Review scale and rig. Automated GLB imports require Studio-specific permissions and are not assumed to work."};
}
server.setRequestHandler(CallToolRequestSchema,async(request)=>{
 try {
   const {name,arguments:args}=request.params;
   if(name==="blender_status")return safeText({available:!!blender&&existsSync(blender),blenderExecutable:blender,outputFolder:outputs,bundled:true});
   if(name==="blender_generate_model"||name==="blender_generate_animation") {
     const plan=validate(args);
     if(name==="blender_generate_animation"&&(!args?.animation||args.animation==="none"))throw Error("Choose idle, walk, run or attack");
     return safeText(await runBlender(plan));
   }
   if(name==="blender_list_outputs"){
     const dirs=(await readdir(outputs,{withFileTypes:true})).filter(d=>d.isDirectory()&&d.name.startsWith("model-"));
     const entries=await Promise.all(dirs.map(async d=>{
       const path=join(outputs,d.name);
       const info=await stat(path);
       let report=null;try{report=JSON.parse(await readFile(join(path,"report.json"),"utf8"))}catch{}
       return {path,mtime:info.mtimeMs,report};
     }));
     return safeText(entries.sort((a,b)=>b.mtime-a.mtime).slice(0,15));
   }
   return fail("Unknown Blender tool: "+name);
 }catch(e){return fail(e instanceof Error?e.message:String(e))}
});
const transport=new StdioServerTransport();
await server.connect(transport);
