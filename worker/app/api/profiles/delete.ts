import type { HonoOpenAPIRouterType, OpenAPIRouteSchema } from "chanfana";
import { NotFoundException, OpenAPIRoute } from "chanfana";
import type { Env, Schema } from "hono";
import z from "zod";
import type { Context } from "../../../types";
import type { Profiles } from "./schema";
import { getProfiles, putProfiles } from "./utils";

export class DeleteProfile extends OpenAPIRoute {
  static register<
    E extends Env = Env,
    S extends Schema = Schema,
    BasePath extends string = "/",
  >(
    openapi: HonoOpenAPIRouterType<E, S, BasePath>,
  ): HonoOpenAPIRouterType<E, S, BasePath> {
    openapi.delete("/api/profiles/:id", DeleteProfile);
    return openapi;
  }

  override schema = {
    request: {
      params: z.object({
        id: z.uuid(),
      }),
    },
    responses: {
      204: { description: "No Content" },
      ...NotFoundException.schema(),
    },
  } satisfies OpenAPIRouteSchema;

  override async handle(c: Context): Promise<Response> {
    const { params } = await this.getValidatedData<typeof this.schema>();
    const profiles: Profiles = await getProfiles(c);
    if (!(params.id in profiles))
      throw new NotFoundException(`Profile not found: ${params.id}`);
    delete profiles[params.id];
    await putProfiles(c, profiles);
    return c.body(null, 204);
  }
}
