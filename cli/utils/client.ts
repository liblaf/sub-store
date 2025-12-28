import type { Profile, Profiles } from "@shared/schema/profile";
import type { Provider, Providers } from "@shared/schema/provider";
import type { KyInstance, KyResponse } from "ky";
import ky from "ky";

export function createClient(): KyInstance {
  const url: string = process.env.SUB_STORE_URL ?? "https://sub.liblaf.me";
  const token: string = process.env.SUB_STORE_TOKEN!;
  return ky.create({
    headers: { Authorization: `Bearer ${token}` },
    prefixUrl: url,
    redirect: "follow",
  });
}

export class SubStoreClient {
  private client: KyInstance;

  constructor(
    url: string = process.env.SUB_STORE_URL ?? "https://sub.liblaf.me",
    token: string = process.env.SUB_STORE_TOKEN!,
  ) {
    this.client = ky.create({
      headers: { Authorization: `Bearer ${token}` },
      prefixUrl: url,
      redirect: "follow",
    });
  }

  async listProfiles(): Promise<Profiles> {
    type ListProfilesResponse = { success: boolean; result: Profile[] };
    const response: ListProfilesResponse = await this.client
      .get("api/profiles")
      .json<ListProfilesResponse>();
    const profiles: Profiles = {};
    for (const profile of response.result) {
      profiles[profile.id] = profile;
    }
    return profiles;
  }

  async uploadProfileArtifact(
    id: string,
    filename: string,
    content: string,
  ): Promise<void> {
    await this.client.post(`api/profiles/${id}/${filename}`, { body: content });
  }

  async createProvider(provider: Provider): Promise<void> {
    await this.client.post(`api/providers/${provider.id}`, { json: provider });
  }

  async listProviders(): Promise<Providers> {
    type ListProvidersResponse = { success: boolean; result: Provider[] };
    const response: ListProvidersResponse = await this.client
      .get("api/providers")
      .json<ListProvidersResponse>();
    const providers: Providers = {};
    for (const provider of response.result) {
      providers[provider.id] = provider;
    }
    return providers;
  }

  async downloadProviderArtifact(
    id: string,
    filename: string,
  ): Promise<KyResponse> {
    return await this.client.get(`api/providers/${id}/${filename}`);
  }

  async uploadProviderArtifact(
    id: string,
    filename: string,
    content: string | any,
  ): Promise<void> {
    if (filename.endsWith(".json")) {
      await this.client.post(`api/providers/${id}/${filename}`, {
        json: content,
      });
      return;
    } else {
      await this.client.post(`api/providers/${id}/${filename}`, {
        body: content,
      });
    }
  }
}
