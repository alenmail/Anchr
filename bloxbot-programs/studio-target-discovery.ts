async function run({ callTool }: { input: unknown; callTool: (name: string, args: Record<string, unknown>) => Promise<unknown> }) {
  const result = await callTool("get_connected_instances", {});
  const error = mcpErrorText(result);
  if (error) throw new Error(error);
  const data = normalizeMcpResult(result) ?? {};
  const instances = Array.isArray(data.instances) ? data.instances : [];
  const targets = instances.flatMap((row: any) => {
    const key = normalizeMcpIdentifier(row?.id);
    if (!key) return [];
    const placeId = normalizeMcpIdentifier(row?.placeId);
    return [{
      key,
      label: typeof row?.placeName === "string" && row.placeName ? row.placeName : key,
      detail: placeId ? "Place " + placeId : "Local place",
      placeId,
    }];
  });
  return { targets, selectedKey: null };
}
