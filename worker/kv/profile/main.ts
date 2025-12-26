import type { Profile, Profiles } from "./schema";

export type ProfileArtifactMetadata = {
  lastUpdated: number;
};

export type ReadProfileArtifactResult = {
  value: string | null;
  metadata: ProfileArtifactMetadata | null;
};

export class ProfileStore {
  constructor(private readonly kv: KVNamespace) {}

  async create(profile: Profile): Promise<Profile> {
    const profiles: Profiles = await this.list();
    profiles[profile.id] = profile;
    await this.put(profiles);
    return profile;
  }

  async read(id: string): Promise<Profile | null> {
    const profiles: Profiles = await this.list();
    return profiles[id] ?? null;
  }

  async delete(id: string): Promise<Profile | null> {
    const profiles: Profiles = await this.list();
    const profile: Profile | undefined = profiles[id];
    if (!profile) return null;
    await this.deleteAllArtifacts(id);
    delete profiles[id];
    await this.put(profiles);
    return profile;
  }

  async list(): Promise<Profiles> {
    const profiles: Profiles | null = await this.kv.get("profiles", "json");
    if (!profiles) return {};
    return profiles;
  }

  async createArtifact(
    id: string,
    filename: string,
    value: string,
  ): Promise<void> {
    const key: string = `profiles/${id}/${filename}`;
    const metadata: ProfileArtifactMetadata = { lastUpdated: Date.now() };
    await this.kv.put(key, value, { metadata });
  }

  async deleteAllArtifacts(id: string): Promise<void> {
    const prefix: string = `profiles/${id}/`;
    const { keys } = await this.kv.list({ prefix });
    await Promise.all(
      keys.map(
        async ({ name }: KVNamespaceListKey<unknown, string>): Promise<void> =>
          await this.kv.delete(name),
      ),
    );
  }

  private async put(profiles: Profiles): Promise<void> {
    await this.kv.put("profiles", JSON.stringify(profiles));
  }
}
