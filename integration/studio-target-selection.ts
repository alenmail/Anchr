async function run({ input, callTool }: { input: any; callTool: (name: string, args: Record<string, unknown>) => Promise<unknown> }) {
  const targetKey = typeof input?.targetKey === "string" ? input.targetKey : "";
  if (!targetKey) throw new Error("Anchr requires a Studio target");
  const data = normalizeMcpResult(await callTool("get_connected_instances", {})) ?? {};
  const instances = Array.isArray(data.instances) ? data.instances : [];
  const selected = instances.find((instance: any) => normalizeMcpIdentifier(instance?.id) === targetKey);
  if (!selected) throw new Error("Anchr cannot verify this Studio instance");
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
