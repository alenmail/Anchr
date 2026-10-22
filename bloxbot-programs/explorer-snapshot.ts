async function run({ input, callTool }: { input: { studioId: string }; callTool: (name: string, args: Record<string, unknown>) => Promise<unknown> }) {
  const instanceId = typeof input?.studioId === "string" ? input.studioId : "";
  if (!instanceId) throw new Error("Select a connected Studio instance");
  const overviewResult = await callTool("get_project_structure", { path: "game", instance_id: instanceId });
  const error = mcpErrorText(overviewResult);
  if (error) throw new Error(error);
  const overview = normalizeMcpResult(overviewResult) ?? {};
  if (overview.error) throw new Error(String(overview.error));
  const services = Array.isArray(overview.services) ? overview.services : [];
  const roots: any[] = [];
  let remaining = 2500;
  function normalize(row: any): any {
    if (remaining-- <= 0) return null;
    const children: any[] = Array.isArray(row.children) ? row.children.map(normalize).filter(Boolean) : [];
    const rawPath = typeof row.path === "string" ? row.path : "";
    const path = rawPath.startsWith("game.") ? rawPath : "game." + rawPath.replace(/^game\.?/, "");
    return {
      name: typeof row.name === "string" ? row.name : path.split(".").at(-1) || "Instance",
      className: typeof row.className === "string" ? row.className : "Instance",
      path,
      hasChildren: children.length > 0 || row.hasChildren === true || (row.childCount ?? 0) > children.length || row.hasMore === true,
      properties: [], attributes: [], children,
    };
  }
  for (const service of services) {
    if (remaining <= 0) break;
    const path = service.path || `game.${service.name}`;
    const result = await callTool("get_project_structure", { path, maxDepth: 7, instance_id: instanceId });
    const data = mcpErrorText(result) ? service : normalizeMcpResult(result);
    const node = normalize(data?.error ? service : data);
    if (node) roots.push(node);
  }
  const topology = normalizeMcpResult(await callTool("get_connected_instances", {})) ?? {};
  const selected = (Array.isArray(topology.instances) ? topology.instances : []).find((row: any) => String(row?.id) === instanceId);
  const placeName = typeof selected?.placeName === "string" && selected.placeName ? selected.placeName : "Roblox Studio";
  return { placeName, capturedAt: new Date().toISOString(), roots };
}
