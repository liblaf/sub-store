import type { FetchMihomoResult } from "@shared/fetch/inner/mihomo";
import { fetchMihomo } from "@shared/fetch/mihomo";
import { Sublink } from "@shared/fetch/utils/sublink";
import type { Provider } from "@shared/schema/provider";
import { PROVIDER_ID_SCHEMA } from "@shared/schema/provider";
import type { Userinfo } from "@shared/schema/userinfo";
import { serializeUserinfo } from "@shared/schema/userinfo";
import { ProviderStore } from "@worker/kv/provider";
import type { Context } from "@worker/types";
import type { RequestMethod } from "@worker/utils/route";
import type { OpenAPIRouteSchema } from "chanfana";
import {
  ApiException,
  MultiException,
  NotFoundException,
  OpenAPIRoute,
} from "chanfana";
import { env } from "hono/adapter";
import z from "zod/v3";

type Metadata = {
  fromCache: boolean;
  mtime?: number;
};

type FetchResult = FetchMihomoResult & {
  metadata: Metadata;
};

export class DownloadProviderMihomo extends OpenAPIRoute {
  static method: RequestMethod = "get";
  static path: string = "/api/providers/:id/mihomo.yaml";

  override schema = {
    tags: ["Providers"],
    summary: "Download Provider mihomo.yaml",
    request: {
      params: z.object({
        id: PROVIDER_ID_SCHEMA,
      }),
    },
    responses: {
      200: {
        description: "OK",
        content: {
          "application/yaml": {
            schema: z.any(),
          },
        },
      },
      ...NotFoundException.schema(),
    },
  } satisfies OpenAPIRouteSchema;

  override async handle(c: Context): Promise<Response> {
    const { params } = await this.getValidatedData<typeof this.schema>();
    const { id } = params;
    const store = new ProviderStore(this.kv);
    const provider: Provider | null = await store.read(id);
    if (!provider) throw new NotFoundException();
    const { content, userinfo, metadata } = await this.fetchMihomo(
      c,
      store,
      provider,
    );
    const headers = new Headers();
    headers.set("Content-Type", "application/yaml");
    headers.set("Subscription-Userinfo", serializeUserinfo(userinfo));
    headers.set("X-From-Cache", `${metadata.fromCache}`);
    if (metadata.mtime) {
      headers.set("X-Last-Modified", new Date(metadata.mtime).toUTCString());
    }
    return new Response(content, { headers });
  }

  async fetchMihomo(
    c: Context,
    store: ProviderStore,
    provider: Provider,
  ): Promise<FetchResult> {
    const sublink = new Sublink(env(c).SUBLINK_URL, env(c).SUBLINK);
    const errors: unknown[] = [];
    try {
      const { content, userinfo } = await fetchMihomo(provider, sublink);
      return {
        content,
        userinfo,
        metadata: { fromCache: false, mtime: Date.now() },
      };
    } catch (err) {
      errors.push(err);
    }
    try {
      const { content, metadata } = await store.artifacts.text(
        provider.id,
        "mihomo.yaml",
      );
      const { content: userinfo } = await store.artifacts.json<Userinfo>(
        provider.id,
        "userinfo.json",
      );
      if (!content) throw new NotFoundException();
      return {
        content,
        userinfo: userinfo ?? {},
        metadata: { fromCache: true, mtime: metadata?.mtime },
      };
    } catch (err) {
      errors.push(err);
    }
    throw new MultiException(
      errors.map((err: unknown): ApiException => {
        if (err instanceof ApiException) return err;
        return new ApiException(`${err}`);
      }),
    );
  }
}
