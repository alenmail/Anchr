import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { strict as assert } from "node:assert";

const root=process.cwd();
const cli=join(root,"vendor","anchr-mcp","node_modules","anchr-blender-mcp.mjs");
const blender=join(root,"vendor","blender-runtime","blender.exe");
const py=join(root,"vendor","anchr-mcp","node_modules","anchr-blender-backend.py");
assert(existsSync(cli),"Blender MCP script was not bundled");
assert(existsSync(blender),"Blender executable missing");
assert(existsSync(py),"Blender Python worker missing");
const client=new Client({name:"anchr-ci",version:"0.2.0"},{capabilities:{}});
const transport=new StdioClientTransport({command:process.execPath,args:[cli],
  env:{...process.env,ANCHR_BLENDER_PATH:blender,ANCHR_BLENDER_BACKEND:py,
    ANCHR_CREATIVE_OUTPUT:join(process.env.RUNNER_TEMP||root,"anchr-test-models")},stderr:"pipe"});
try{
  await client.connect(transport);
  const {tools}=await client.listTools();
  for(const name of ["blender_status","blender_generate_model","blender_generate_animation","blender_list_outputs"])
    assert(tools.some(t=>t.name===name),"Missing MCP tool "+name);
  const status=await client.callTool({name:"blender_status",arguments:{}});
  assert(!status.isError,"Blender status failed");
  const model=await client.callTool({name:"blender_generate_model",arguments:{
    name:"Anchr CI test prop",archetype:"prop",style:"stylized",detail:1,animation:"none",
  }},{timeout:210000});
  assert(!model.isError,"Blender generator tool failed: "+JSON.stringify(model.content));
  const txt=model.content.find(x=>x.type==="text");
  const data=JSON.parse(txt.text);
  for(const path of [data.model,data.preview,data.blend]) assert(existsSync(path),"Missing Blender output "+path);
  console.log("ANCHR_BLENDER_MCP_OK",data.model,data.preview);
}finally{
  await client.close().catch(()=>{});
}
