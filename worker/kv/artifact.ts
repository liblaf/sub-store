export type ArtifactMetadata = {
  mtime: number;
};

export type ArtifactWithMetadata<T = string> = {
  content: T | null;
  metadata: ArtifactMetadata | null;
};

export class ArtifactStore {
  constructor(
    private kv: KVNamespace,
    private prefix: string,
  ) {}

  async create(id: string, filename: string, content: string): Promise<void> {
    const key: string = this.key(id, filename);
    const metadata = { mtime: Date.now() };
    await this.kv.put(key, content, { metadata });
  }

  async text(id: string, filename: string): Promise<ArtifactWithMetadata> {
    const key: string = this.key(id, filename);
    const { value, metadata } =
      await this.kv.getWithMetadata<ArtifactMetadata>(key);
    return { content: value, metadata };
  }

  async json<T>(
    id: string,
    filename: string,
  ): Promise<ArtifactWithMetadata<T>> {
    const key: string = this.key(id, filename);
    const { value, metadata } = await this.kv.getWithMetadata<
      T,
      ArtifactMetadata
    >(key, "json");
    return { content: value, metadata };
  }

  async delete(id: string, filename: string): Promise<void> {
    const key: string = this.key(id, filename);
    await this.kv.delete(key);
  }

  async clear(id: string): Promise<void> {
    const prefix: string = `${this.prefix}/${id}/`;
    const { keys } = await this.kv.list<ArtifactMetadata>({ prefix });
    await Promise.all(
      keys.map(
        async ({
          name,
        }: KVNamespaceListKey<ArtifactMetadata, string>): Promise<void> =>
          await this.kv.delete(name),
      ),
    );
  }

  protected key(id: string, filename: string): string {
    return `${this.prefix}/${id}/${filename}`;
  }
}
