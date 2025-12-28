import type { Profile, Profiles } from "@shared/schema/profile";
import type { Provider, Providers } from "@shared/schema/provider";
import { defaultClient } from "@shared/utils";
import consola from "consola";
import type { KyInstance, KyResponse } from "ky";

export class SubStoreClient {
  private client: KyInstance;

  constructor(
    url: string = process.env.SUB_STORE_URL ?? "https://sub.liblaf.me",
    token: string = process.env.SUB_STORE_TOKEN!,
  ) {
    const client: KyInstance = defaultClient();
    this.client = client.extend({
      headers: { Authorization: `Bearer ${token}` },
      prefixUrl: url,
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
    const response: KyResponse = await this.client.get(
      `api/providers/${id}/${filename}`,
    );
    if (response.headers.get("X-From-Cache") === "true") {
      consola.warn(
        `providers/${id}/${filename} is from cache, it may be outdated.`,
      );
    }
    return response;
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
