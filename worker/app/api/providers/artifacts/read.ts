import type { Context, RequestMethod } from "@worker/app/_abc";
import { OpenAPIRoute } from "@worker/app/_abc";
import { ProviderStore } from "@worker/kv";
import type { OpenAPIRouteSchema } from "chanfana";
import { NotFoundException } from "chanfana";
import z from "zod/v3";

export class ReadProviderArtifact extends OpenAPIRoute {
  static override method: RequestMethod = "get";
  static override path: string = "/api/providers/:name/:filename";

  override schema = {
    tags: ["Providers"],
    summary: "Read Provider Artifact",
    request: {
      params: z.object({
        name: z.string(),
        filename: z.string(),
      }),
      query: z.object({
        token: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": { schema: z.any() },
          "application/yaml": { schema: z.any() },
          "text/plain": { schema: z.string() },
        },
      },
      ...NotFoundException.schema(),
    },
  } satisfies OpenAPIRouteSchema;

  override async handle(c: Context): Promise<Response> {
    const { params } = await this.getValidatedData<typeof this.schema>();
    const { name, filename } = params;
    const store = new ProviderStore(this.kv);
    const { value, metadata } = await store.readArtifact(name, filename);
    if (!value) throw new NotFoundException();
    if (metadata)
      c.header("X-Last-Updated", new Date(metadata.lastUpdated).toISOString());
    return c.text(value);
  }
}
