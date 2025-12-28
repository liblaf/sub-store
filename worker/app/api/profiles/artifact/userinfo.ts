import type { Profile } from "@shared/schema/profile";
import { PROFILE_ID_SCHEMA } from "@shared/schema/profile";
import type { Provider, ProviderId } from "@shared/schema/provider";
import { PROVIDER_ID_SCHEMA } from "@shared/schema/provider";
import type { Userinfo } from "@shared/schema/userinfo";
import { USERINFO_SCHEMA } from "@shared/schema/userinfo";
import { UserinfoWorkerFetcher } from "@worker/fetch/userinfo";
import { ProfileStore } from "@worker/kv/profile";
import { ProviderStore } from "@worker/kv/provider";
import type { Context } from "@worker/types";
import type { RequestMethod } from "@worker/utils/route";
import type { OpenAPIRouteSchema } from "chanfana";
import { contentJson, NotFoundException, OpenAPIRoute } from "chanfana";
import { z } from "zod/v3";

const USERINFO_WITH_METADATA_SCHEMA = z.object({
  userinfo: USERINFO_SCHEMA,
  metadata: z.object({
    fromCache: z.boolean(),
    mtime: z.string().datetime(),
  }),
});
type UserinfoWithMetadata = z.infer<typeof USERINFO_WITH_METADATA_SCHEMA>;

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
    const providerStore = new ProviderStore(this.kv);
    const providers: Provider[] = Object.values(
      await providerStore.list(),
    ).filter((provider: Provider): boolean =>
      profile.providers.includes(provider.id),
    );
    const fetcher = new UserinfoWorkerFetcher(c);
    const results: Array<[Provider, UserinfoWithMetadata] | undefined> =
      await Promise.all(
        providers.map(
          async (
            provider: Provider,
          ): Promise<[Provider, UserinfoWithMetadata] | undefined> => {
            try {
              const { userinfo, metadata } = await fetcher.fetch(provider);
              return [
                provider,
                {
                  userinfo,
                  metadata: {
                    fromCache: metadata.fromCache,
                    mtime: new Date(metadata.mtime).toISOString(),
                  },
                },
              ];
            } catch (err) {
              c.header("X-Error", `Provider ${provider.id}: ${err}`, {
                append: true,
              });
            }
          },
        ),
      );
    const result: Record<ProviderId, Userinfo> = {};
    for (const item of results) {
      if (!item) continue;
      const [provider, userinfo] = item;
      result[provider.id] = userinfo;
    }
    return c.json(result);
  }
}
