import { app, safeStorage } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";

// Figma personal token is encrypted at rest with the operating system's key store.
const path=()=>join(app.getPath("userData"),"figma-token.dat");
async function token(){
  try {return safeStorage.decryptString(await readFile(path()));}
  catch(e){if(e && typeof e==="object" && "code" in e && e.code==="ENOENT")return "";throw e;}
}
export async function figmaConfigured(){return !!(await token());}
export async function setFigmaToken(value:string){
  if(typeof value!=="string"||value.length>2048)throw Error("Invalid Figma token");
  if(!safeStorage.isEncryptionAvailable())throw Error("Secure storage unavailable");
  await writeFile(path(),safeStorage.encryptString(value.trim()),{mode:0o600});return !!value.trim();
}
function parseUrl(raw:string){
  if(typeof raw!=="string"||raw.length>2048)throw Error("Invalid Figma URL");
  const url=new URL(raw);
  if(url.protocol!=="https:"||!["figma.com","www.figma.com"].includes(url.hostname))throw Error("Use a figma.com design URL");
  const p=url.pathname.split("/").filter(Boolean),id=url.searchParams.get("node-id");
  if(!["file","design"].includes(p[0])||!/^[\w-]{8,80}$/.test(p[1]||""))throw Error("Unsupported Figma URL");
  return {key:p[1],id:id?.replace("-",":")};
}
async function request<T>(fragment:string):Promise<T>{
  const credential=await token();if(!credential)throw Error("Connect Figma first");
  const result=await fetch("https://api.figma.com/v1/"+fragment,{
    headers:{"X-Figma-Token":credential,Accept:"application/json"},signal:AbortSignal.timeout(20000)});
  if(!result.ok)throw Error(result.status===429?"Figma API rate limited; try again later":result.status===403||result.status===401?"Figma token needs file_content:read and access to this file":"Figma API HTTP "+result.status);
  const response=await result.text();if(response.length>5_000_000)throw Error("Figma response too large: select a smaller frame");
  return JSON.parse(response) as T;
}
type Node={id:string;name:string;type:string;visible?:boolean;characters?:string;style?:{fontSize?:number;textAlignHorizontal?:string};absoluteBoundingBox?:{x:number;y:number;width:number;height:number};fills?:Array<{type?:string;visible?:boolean;color?:{r:number;g:number;b:number}}>;cornerRadius?:number;children?:Node[]};
export async function listFigmaFrames(raw:string){
  const ref=parseUrl(raw);
  const data=await request<{name?:string;document:Node}>("files/"+encodeURIComponent(ref.key)+"?depth=3");
  const frames:Array<{id:string;name:string}>=[];
  function walk(n:Node,d=0){
    if(d>3||frames.length>100)return;
    if(["FRAME","COMPONENT","INSTANCE"].includes(n.type))frames.push({id:n.id,name:n.name});
    for(const child of n.children||[])walk(child,d+1);
  }
  walk(data.document);
  return {name:data.name||"Figma file",frames,selected:ref.id||""};
}
/**
 * Read-only, bounded Figma design context for the coding agent.
 * Inspired by GLips/Figma-Context-MCP's reduced-layout approach, without
 * duplicating its token handling or installing a second Figma MCP server.
 */
export async function getFigmaDesignContext(raw:string,selectedNodeId?:string){
  const ref=parseUrl(raw);
  const id=selectedNodeId?.trim().replace(/-/g,":")||ref.id;
  if(id&&!/^\\d+:\\d+$/.test(id))throw Error("Invalid Figma node ID");
  const endpoint=id
    ?"files/"+encodeURIComponent(ref.key)+"/nodes?ids="+encodeURIComponent(id)+"&depth=10"
    :"files/"+encodeURIComponent(ref.key)+"?depth=7";
  const data=await request<any>(endpoint);
  const root:Node|undefined=id?data.nodes?.[id]?.document:data.document;
  if(!root)throw Error("Figma node could not be read");
  let count=0;
  const maxNodes=160,maxDepth=8;
  function simplify(n:Node,depth=0):Record<string,unknown>|null{
    if(n.visible===false||depth>maxDepth||count>=maxNodes)return null;
    count++;
    const extra=n as Node & {
      layoutMode?:string;primaryAxisAlignItems?:string;counterAxisAlignItems?:string;
      itemSpacing?:number;layoutWrap?:string;paddingLeft?:number;paddingTop?:number;
      paddingRight?:number;paddingBottom?:number;opacity?:number;
      layoutSizingHorizontal?:string;layoutSizingVertical?:string;
      strokes?:Array<{type?:string;color?:{r:number;g:number;b:number}}>;
    };
    const b=n.absoluteBoundingBox;
    const solid=n.fills?.find(f=>f.type==="SOLID"&&f.visible!==false)?.color;
    const children=(n.children||[]).map(c=>simplify(c,depth+1)).filter((v):v is Record<string,unknown>=>v!==null);
    return {
      id:n.id,name:n.name.slice(0,100),type:n.type,
      ...(b?{bounds:{x:b.x,y:b.y,width:b.width,height:b.height}}:{}),
      ...(extra.layoutMode?{layout:{mode:extra.layoutMode,
        justify:extra.primaryAxisAlignItems,align:extra.counterAxisAlignItems,
        gap:extra.itemSpacing,wrap:extra.layoutWrap,
        padding:[extra.paddingTop,extra.paddingRight,extra.paddingBottom,extra.paddingLeft],
        horizontalSizing:extra.layoutSizingHorizontal,verticalSizing:extra.layoutSizingVertical}}:{}),
      ...(solid?{solidFill:solid}:{}),
      ...(extra.opacity!==undefined?{opacity:extra.opacity}:{}),
      ...(n.cornerRadius!==undefined?{cornerRadius:n.cornerRadius}:{}),
      ...(n.type==="TEXT"?{text:(n.characters||"").slice(0,1600),fontSize:n.style?.fontSize,textAlign:n.style?.textAlignHorizontal}:{}),
      ...(n.type==="VECTOR"||n.type==="IMAGE"?{assetNote:"Visual asset must be uploaded to Roblox separately"}:{}),
      ...(children.length?{children}:{}),
    };
  }
  const design=simplify(root);
  return {source:"Figma design context (Anchr; adapted reduced context approach)",
    readOnly:true,fileKey:ref.key,selectedNode:id||root.id,nodesReturned:count,
    truncated:count>=maxNodes,design};
}
function color(v?:{r:number;g:number;b:number}){
  return "Color3.fromRGB("+[v?.r??.3,v?.g??.33,v?.b??.38].map(x=>Math.max(0,Math.min(255,Math.round(x*255)))).join(",")+")";
}
function luau(n:Node){
  const bounds=n.absoluteBoundingBox||{x:0,y:0,width:900,height:600};
  const out=["-- Generated by Anchr. Review this script before applying to a place.",
    'local gui = Instance.new("ScreenGui")','gui.Name = '+JSON.stringify("Anchr_"+n.name.slice(0,50)),
    "gui.ResetOnSpawn = false",'gui.Parent = game:GetService("StarterGui")'];
  const skipped:string[]=[];let count=0;
  function walk(x:Node,depth=0,parentName="gui",parentBounds=bounds){
    if(x.visible===false||depth>10||count>=200)return;
    const id="i"+(++count),b=x.absoluteBoundingBox;
    const type=x.type==="TEXT"?"TextLabel":/button|btn/i.test(x.name)?"TextButton":/VECTOR|IMAGE/.test(x.type)?"TextLabel":"Frame";
    out.push("local "+id+" = Instance.new("+JSON.stringify(type)+")");
    out.push(id+".Name = "+JSON.stringify(x.name.slice(0,75)));
    // Figma gives absolute coordinates; Roblox child positions must be local to their parent.
    out.push(id+".Position = UDim2.fromOffset("+Math.round((b?.x??parentBounds.x)-parentBounds.x)+","+Math.round((b?.y??parentBounds.y)-parentBounds.y)+")");
    out.push(id+".Size = UDim2.fromOffset("+Math.max(1,Math.round(b?.width||90))+","+Math.max(1,Math.round(b?.height||36))+")");
    const fill=x.fills?.find(f=>f.type==="SOLID"&&f.visible!==false);
    out.push(id+(fill?.color?".BackgroundColor3 = "+color(fill.color):".BackgroundTransparency = 1"));
    if(type==="TextLabel"||type==="TextButton"){
      out.push(id+".Text = "+JSON.stringify(x.type==="TEXT"?(x.characters||"").slice(0,1500):/VECTOR|IMAGE/.test(x.type)?"◇":""));
      out.push(id+".Font = Enum.Font.Gotham");
      out.push(id+".TextSize = "+Math.max(8,Math.min(70,Math.round(x.style?.fontSize||16))));
      out.push(id+".TextWrapped = true");
    }
    if(/VECTOR|IMAGE/.test(x.type))skipped.push(x.name);
    if(x.cornerRadius){out.push('local c'+count+' = Instance.new("UICorner")');out.push("c"+count+".CornerRadius = UDim.new(0,"+Math.min(100,Math.round(x.cornerRadius))+")");out.push("c"+count+".Parent = "+id);}
    out.push(id+".Parent = "+parentName);
    for(const child of x.children||[])walk(child,depth+1,id,b||parentBounds);
  }
  walk(n);
  return {code:out.join("\n")+"\n",convertedNodes:count,unconvertedVisuals:skipped};
}
export async function generateFigmaUi(raw:string,nodeId:string){
  const {key}=parseUrl(raw);
  if(!/^\d+:\d+$/.test(nodeId))throw Error("Choose a valid Figma frame");
  const data=await request<{nodes:Record<string,{document:Node}>}>("files/"+encodeURIComponent(key)+"/nodes?ids="+encodeURIComponent(nodeId)+"&depth=10");
  const root=data.nodes?.[nodeId]?.document;
  if(!root)throw Error("Frame could not be loaded");
  const result=luau(root),dir=join(app.getPath("documents"),"Anchr","Creative","Figma");
  await mkdir(dir,{recursive:true});
  const file=join(dir,"figma-"+nodeId.replace(":","-")+"-"+Date.now()+".luau");
  await writeFile(file,result.code,"utf8");
  return {...result,file};
}

/** Authenticated loopback bridge for the bundled Anchr Figma MCP subprocess.
 * Figma credentials remain in OS secure storage, not in OpenCode's JSON config.
 */
let bridgePromise: Promise<{url:string;secret:string}>|null = null;
export function getFigmaBridge():Promise<{url:string;secret:string}> {
  if(bridgePromise)return bridgePromise;
  bridgePromise=new Promise((resolve,reject)=>{
    const secret=randomBytes(32).toString("hex");
    const server=createServer(async(request,response)=>{
      if(request.method!=="POST"||request.url!=="/figma"){
        response.writeHead(404).end();return;
      }
      const auth=(request.headers.authorization||"").replace(/^Bearer /,"");
      const authorized=auth.length===secret.length &&
        timingSafeEqual(Buffer.from(auth),Buffer.from(secret));
      if(!authorized){response.writeHead(401).end();return;}
      let body="";for await(const data of request){
        body+=data.toString("utf8");if(body.length>8192){response.writeHead(413).end();return;}
      }
      response.setHeader("Content-Type","application/json");
      response.setHeader("Cache-Control","no-store");
      try{
        const input=JSON.parse(body) as {method?:string;arguments?:{url?:string;nodeId?:string}};
        const args=input.arguments||{};
        let result:unknown;
        if(input.method==="context"&&typeof args.url==="string")
          result=await getFigmaDesignContext(args.url,args.nodeId);
        else if(input.method==="frames"&&typeof args.url==="string")result=await listFigmaFrames(args.url);
        else if(input.method==="generate"&&typeof args.url==="string"&&typeof args.nodeId==="string")
          result=await generateFigmaUi(args.url,args.nodeId);
        else throw Error("Invalid Figma request");
        response.writeHead(200).end(JSON.stringify({result}));
      }catch(e){
        response.writeHead(400).end(JSON.stringify({error:e instanceof Error?e.message:"Figma bridge failed"}));
      }
    });
    server.on("error",reject);
    server.listen(0,"127.0.0.1",()=>{
      const address=server.address();
      if(!address||typeof address==="string"){reject(Error("Figma bridge listen failed"));return;}
      server.unref();
      resolve({url:"http://127.0.0.1:"+address.port+"/figma",secret});
    });
  });
  return bridgePromise;
}
