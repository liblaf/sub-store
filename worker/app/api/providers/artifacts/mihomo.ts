import type { Context, RequestMethod } from "@worker/app/_abc";
import { OpenAPIRoute } from "@worker/app/_abc";
import type { Provider } from "@worker/kv";
import { ProviderStore } from "@worker/kv";
import type { OpenAPIRouteSchema } from "chanfana";
import { ApiException, NotFoundException } from "chanfana";
import { env } from "hono/adapter";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import yaml from "js-yaml";
import z from "zod/v3";

export class ReadProviderArtifactMihomo extends OpenAPIRoute {
  static override method: RequestMethod = "get";
  static override path: string = "/api/providers/:name/mihomo.yaml";

  override schema = {
    tags: ["Providers"],
    summary: "Read Provider mihomo.yaml",
    request: {
      params: z.object({
        name: z.string(),
      }),
      query: z.object({
        convert: z.boolean().default(true),
        token: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: "OK",
        content: {
          "application/yaml": { schema: z.any() },
        },
      },
    },
  } satisfies OpenAPIRouteSchema;

  override async handle(c: Context): Promise<Response> {
    return c.text("Not Implemented", 501);
  }

  async fetchFromUpstream(provider: Provider): Promise<Response> {
    if (!provider.mihomo) {
      throw new NotFoundException(
        `Provider ${provider.name} does not support mihomo.yaml`,
      );
    }
    const response = await fetch(provider.mihomo, {
      headers: { "User-Agent": "clash.meta" },
      redirect: "follow",
    });
    if (!response.ok) {
      throw new HTTPException(response.status as ContentfulStatusCode, {
        res: response,
        message: `Failed to fetch mihomo.yaml from provider ${provider.name}`,
      });
    }
    return response;
  }

  async fetchFromSublink(provider: Provider): Promise<Response> {
    if (!provider.xray) {
      throw new NotFoundException(
        `Provider ${provider.name} does not support xray.txt`,
      );
    }
    const baseUrl: string = env(this.ctx).SUBLINK_URL;
    const url = new URL(`${baseUrl}/clash`);
    url.searchParams.set("config", provider.xray);
    const response = await env(this.ctx).SUBLINK.fetch(url, {
      headers: { "User-Agent": "clash.meta" },
      redirect: "follow",
    });
    if (!response.ok) {
      throw new HTTPException(response.status as ContentfulStatusCode, {
        res: response,
        message: `Failed to fetch from provider ${provider.name}`,
      });
    }
    const text: string = await response.text();
    const doc = yaml.load(text) as { proxies: any[] };
    if (doc.proxies.length === 0) {
      throw new ApiException(
        `No proxies found in xray.txt from provider ${provider.name}`,
      );
    }
    return response;
  }

  async fetchFromCache(provider: Provider): Promise<Response> {
    const store = new ProviderStore(this.kv);
    const { value, metadata } = await store.readArtifact(
      provider.name,
      "mihomo.yaml",
    );
    if (!value || !metadata)
      throw new NotFoundException(`mihomo.yaml not found in cache`);
    return this.ctx.text(value, {
      headers: {
        "X-Cache-Hit": "true",
        "X-Last-Update": new Date(metadata.lastUpdated).toISOString(),
      },
    });
  }
}
