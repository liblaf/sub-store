import type { Provider } from "@shared/schema/provider";
import { ProviderStore } from "@worker/kv/provider";
import type { Context } from "@worker/types";
import type { RequestMethod } from "@worker/utils/route";
import type { OpenAPIRouteSchema } from "chanfana";
import { contentJson, NotFoundException, OpenAPIRoute } from "chanfana";
import z from "zod/v3";

export class UploadProviderArtifact extends OpenAPIRoute {
  static method: RequestMethod = "post";
  static path: string = "/api/providers/:id/:filename";

  override schema = {
    tags: ["Providers"],
    summary: "Upload Provider Artifact",
    request: {
      body: {
        content: {
          "application/json": { schema: z.any() },
          "application/yaml": { schema: z.any() },
          "text/plain": { schema: z.string() },
        },
      },
      params: z.object({
        id: z.string(),
        filename: z.string(),
      }),
    },
    responses: {
      200: {
        description: "OK",
        ...contentJson(
          z.object({
            success: z.boolean(),
          }),
        ),
      },
      ...NotFoundException.schema(),
    },
  } satisfies OpenAPIRouteSchema;

  override async handle(c: Context): Promise<Response> {
    const { params } = await this.getValidatedData<typeof this.schema>();
    const { id, filename } = params;
    const content: string = await c.req.text();
    const store = new ProviderStore(this.kv);
    const provider: Provider | null = await store.read(id);
    if (!provider) throw new NotFoundException();
    await store.artifacts.create(id, filename, content);
    return c.json({ success: true });
  }
}
