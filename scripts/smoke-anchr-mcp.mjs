import { strict as assert } from "node:assert";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const entry = join(process.cwd(), "vendor", "anchr-mcp", "node_modules", "@chrrxs", "robloxstudio-mcp", "dist", "index.js");
const client = new Client({ name: "anchr-ci-smoke", version: "0.1.0" }, { capabilities: {} });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [entry],
  stderr: "pipe",
});
let timer;
try {
  await Promise.race([
    client.connect(transport),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("MCP handshake timed out")), 20_000); }),
  ]);
  clearTimeout(timer);
  const { tools } = await client.listTools();
  const names = new Set(tools.map((item) => item.name));
  for (const name of ["get_connected_instances", "get_project_structure", "edit_script_lines", "get_runtime_logs"]) {
    assert(names.has(name), `Required Chrrxs MCP tool missing: ${name}`);
  }
  console.log(`[Anchr] MCP stdio handshake succeeded with ${tools.length} tools.`);
} finally {
  clearTimeout(timer);
  await client.close().catch(() => undefined);
}
