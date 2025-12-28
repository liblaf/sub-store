import type { Profile } from "@shared/schema/profile";
import { PROFILE_ID_SCHEMA } from "@shared/schema/profile";
import type { ProviderId } from "@shared/schema/provider";
import { PROVIDER_ID_SCHEMA } from "@shared/schema/provider";
import type { UserinfoWithMetadata } from "@worker/fetch/userinfo";
import {
  ProfileUserinfoWorkerFetcher,
  USERINFO_WITH_METADATA_SCHEMA,
} from "@worker/fetch/userinfo";
import { ProfileStore } from "@worker/kv/profile";
import type { Context } from "@worker/types";
import type { RequestMethod } from "@worker/utils/route";
import type { OpenAPIRouteSchema } from "chanfana";
import { contentJson, NotFoundException, OpenAPIRoute } from "chanfana";
import { z } from "zod/v3";

export class ProfileUserinfo extends OpenAPIRoute {
  static method: RequestMethod = "get";
  static path: string = "/api/profiles/:id/userinfo.json";

  override schema = {
    tags: ["Profiles"],
    summary: "Profile userinfo.json",
    request: {
      params: z.object({
        id: PROFILE_ID_SCHEMA,
      }),
    },
    responses: {
      200: {
        description: "OK",
        ...contentJson(
          z.record(PROVIDER_ID_SCHEMA, USERINFO_WITH_METADATA_SCHEMA),
        ),
      },
      ...NotFoundException.schema(),
    },
  } satisfies OpenAPIRouteSchema;

  override async handle(c: Context): Promise<Response> {
    const { params } = await this.getValidatedData<typeof this.schema>();
    const { id } = params;
    const profileStore = new ProfileStore(this.kv);
    const profile: Profile | null = await profileStore.read(id);
    if (!profile) throw new NotFoundException();
    const fetcher = new ProfileUserinfoWorkerFetcher(c);
    const result: Record<ProviderId, UserinfoWithMetadata> =
      await fetcher.fetch(profile);
    return c.json(result);
  }
}
