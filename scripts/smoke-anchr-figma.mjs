import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";

const worker=join(process.cwd(),"vendor","anchr-mcp","node_modules","anchr-figma-mcp.mjs");
assert(existsSync(worker),"Bundled Figma MCP worker missing");
const client=new Client({name:"anchr-figma-ci",version:"0.2.0"},{capabilities:{}});
const transport=new StdioClientTransport({command:process.execPath,args:[worker],stderr:"pipe"});
try{
  await client.connect(transport);
  const {tools}=await client.listTools();
  for(const name of ["figma_list_frames","figma_generate_roblox_ui"])
    assert(tools.some(t=>t.name===name),"Missing Figma MCP tool "+name);
  const unauth=await client.callTool({name:"figma_list_frames",arguments:{url:"https://www.figma.com/design/TEST/Untitled"}});
  assert(unauth.isError,"Standalone Figma worker must deny unavailable connector");
  console.log("ANCHR_FIGMA_MCP_OK: tools discovered; unauthenticated calls denied.");
} finally{
  await client.close().catch(()=>undefined);
}
