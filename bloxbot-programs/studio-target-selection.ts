async function run({ input, callTool }: { input: any; callTool: (name: string, args: Record<string, unknown>) => Promise<unknown> }) {
  const targetKey = typeof input?.targetKey === "string" ? input.targetKey : "";
  if (!targetKey) throw new Error("Choose a connected Studio instance");
  const result = await callTool("get_connected_instances", {});
  const error = mcpErrorText(result);
  if (error) throw new Error(error);
  const data = normalizeMcpResult(result) ?? {};
  const instances = Array.isArray(data.instances) ? data.instances : [];
  const selected = instances.find((row: any) => normalizeMcpIdentifier(row?.id) === targetKey);
  if (!selected) throw new Error("Anchr could not verify this Studio instance");
  const placeId = normalizeMcpIdentifier(selected.placeId);
  return {
    selected: {
      key: targetKey,
      label: typeof selected.placeName === "string" && selected.placeName ? selected.placeName : targetKey,
      detail: placeId ? "Place " + placeId : "Local place",
      placeId,
    },
    verified: true,
  };
}
