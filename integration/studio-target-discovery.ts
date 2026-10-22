async function run({ callTool }: { input: unknown; callTool: (name: string, args: Record<string, unknown>) => Promise<unknown> }) {
  const data = normalizeMcpResult(await callTool("get_connected_instances", {})) ?? {};
  const instances = Array.isArray(data.instances) ? data.instances : [];
  const targets = instances.flatMap((instance: any) => {
    const key = normalizeMcpIdentifier(instance?.id);
    if (!key) return [];
    const placeId = normalizeMcpIdentifier(instance?.placeId);
    return [{
      key,
      label: typeof instance?.placeName === "string" && instance.placeName ? instance.placeName : key,
      detail: placeId ? "Place " + placeId : "Local place",
      placeId,
    }];
  });
  return { targets, selectedKey: null };
}
