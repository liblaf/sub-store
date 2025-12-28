import type { Provider } from "@shared/schema/provider";
import { PROVIDER_ID_SCHEMA } from "@shared/schema/provider";
import { serializeUserinfo } from "@shared/schema/userinfo";
import { WorkerMihomoFetcher } from "@worker/fetch/mihomo";
import { ProviderStore } from "@worker/kv/provider";
import type { Context } from "@worker/types";
import type { RequestMethod } from "@worker/utils/route";
import type { OpenAPIRouteSchema } from "chanfana";
import { NotFoundException, OpenAPIRoute } from "chanfana";
import z from "zod/v3";

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
    const fetcher = new WorkerMihomoFetcher(c);
    const { content, userinfo, metadata } = await fetcher.fetch(provider);
    c.header("Content-Type", "application/yaml");
    c.header("Subscription-Userinfo", serializeUserinfo(userinfo));
    c.header("X-From-Cache", `${metadata.fromCache}`);
    if (metadata.mtime) {
      c.header("X-Last-Modified", new Date(metadata.mtime).toUTCString());
    }
    return c.text(content);
  }
}
