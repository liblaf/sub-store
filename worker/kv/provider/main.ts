import type { Provider, Providers } from "./schema";

export type ProviderArtifactMetadata = {
  lastUpdated: number;
};

export type ReadProviderArtifactResult = {
  value: string | null;
  metadata: ProviderArtifactMetadata | null;
};

export class ProviderStore {
  constructor(private readonly kv: KVNamespace) {}

  async create(provider: Provider): Promise<Provider> {
    const providers: Providers = await this.list();
    providers[provider.name] = provider;
    await this.put(providers);
    return provider;
  }

  async read(name: string): Promise<Provider | null> {
    const providers: Providers = await this.list();
    return providers[name] ?? null;
  }

  async delete(name: string): Promise<Provider | null> {
    const providers: Providers = await this.list();
    const provider: Provider | undefined = providers[name];
    if (!provider) return null;
    await this.deleteAllArtifacts(name);
    delete providers[name];
    await this.put(providers);
    return provider;
  }

  async list(): Promise<Providers> {
    const providers: Providers | null = await this.kv.get("providers", "json");
    if (!providers) return {};
    return providers;
  }

  async createArtifact(
    name: string,
    filename: string,
    value: string,
  ): Promise<void> {
    const key: string = `providers/${name}/${filename}`;
    const metadata: ProviderArtifactMetadata = { lastUpdated: Date.now() };
    await this.kv.put(key, value, { metadata });
  }

  async readArtifact(
    name: string,
    filename: string,
  ): Promise<ReadProviderArtifactResult> {
    const key: string = `providers/${name}/${filename}`;
    const { value, metadata } =
      await this.kv.getWithMetadata<ProviderArtifactMetadata>(key);
    return { value, metadata };
  }

  async deleteAllArtifacts(name: string): Promise<void> {
    const prefix: string = `providers/${name}/`;
    const { keys } = await this.kv.list({ prefix });
    await Promise.all(
      keys.map(
        async ({ name }: KVNamespaceListKey<unknown, string>): Promise<void> =>
          await this.kv.delete(name),
      ),
    );
  }

  private async put(providers: Providers): Promise<void> {
    await this.kv.put("providers", JSON.stringify(providers));
  }
}
