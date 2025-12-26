import type { Context, RequestMethod } from "@worker/app/_abc";
import { OpenAPIRoute } from "@worker/app/_abc";
import type { Provider } from "@worker/kv";
import { ProviderStore } from "@worker/kv";
import type { OpenAPIRouteSchema } from "chanfana";
import { contentJson, NotFoundException } from "chanfana";
import z from "zod/v3";

export class UploadProviderArtifact extends OpenAPIRoute {
  static override method: RequestMethod = "post";
  static override path: string = "/api/providers/:name/:filename";

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
        name: z.string(),
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
    },
  } satisfies OpenAPIRouteSchema;

  override async handle(c: Context): Promise<Response> {
    const { params } = await this.getValidatedData<typeof this.schema>();
    const content: string = await c.req.text();
    const store = new ProviderStore(this.kv);
    const provider: Provider | null = await store.read(params.name);
    if (!provider) throw new NotFoundException();
    store.createArtifact(params.name, params.filename, content);
    return c.json({ success: true });
  }
}
