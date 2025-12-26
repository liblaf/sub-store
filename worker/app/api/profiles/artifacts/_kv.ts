export async function getProfileArtifact(
  kv: KVNamespace,
  id: string,
  filename: string,
): Promise<string | null> {
  const key = `profile:${id}:${filename}`;
  return await kv.get(key, { type: "text" });
}

export async function putProfileArtifact(
  kv: KVNamespace,
  id: string,
  filename: string,
  content: string,
): Promise<void> {
  const key = `profile:${id}:${filename}`;
  await kv.put(key, content);
}

export async function deleteProfileArtifact(
  kv: KVNamespace,
  id: string,
  filename: string,
): Promise<void> {
  const key = `profile:${id}:${filename}`;
  await kv.delete(key);
}

export async function deleteAllProfileArtifacts(
  kv: KVNamespace,
  id: string,
): Promise<void> {
  const prefix = `profile:${id}:`;
  const { keys } = await kv.list({ prefix });
  await Promise.all(
    keys.map(
      async (key: KVNamespaceListKey<unknown, string>): Promise<void> =>
        await kv.delete(key.name),
    ),
  );
}
