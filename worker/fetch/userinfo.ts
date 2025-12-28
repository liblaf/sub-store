import { UserinfoLocalFetcher } from "@shared/fetch/userinfo";
import type { Profile } from "@shared/schema/profile";
import type { Provider, ProviderId } from "@shared/schema/provider";
import type { Userinfo } from "@shared/schema/userinfo";
import { USERINFO_SCHEMA } from "@shared/schema/userinfo";
import { ProviderStore } from "@worker/kv/provider";
import type { Context } from "@worker/types";
import { env } from "hono/adapter";
import z from "zod";
import type { WorkerFetchResult } from "./abc";
import { WorkerFetcher } from "./abc";

export class UserinfoWorkerFetcher extends WorkerFetcher<Userinfo> {
  override filename: string = "userinfo.json";

  override async fetchFromOrigin(
    provider: Provider,
  ): Promise<WorkerFetchResult<Userinfo>> {
    const fetcher = new UserinfoLocalFetcher(this.sublink);
    const { content, userinfo } = await fetcher.fetch(provider);
    return {
      content,
      userinfo,
      metadata: {
        fromCache: false,
        mtime: Date.now(),
      },
    };
  }
}

export const USERINFO_WITH_METADATA_SCHEMA = z.object({
  userinfo: USERINFO_SCHEMA,
  metadata: z.object({
    fromCache: z.boolean(),
    mtime: z.number(),
  }),
});
export type UserinfoWithMetadata = z.infer<
  typeof USERINFO_WITH_METADATA_SCHEMA
>;

export class ProfileUserinfoWorkerFetcher {
  constructor(private ctx: Context) {}

  get kv(): KVNamespace {
    return env(this.ctx).SUB;
  }

  async fetch(
    profile: Profile,
  ): Promise<Record<ProviderId, UserinfoWithMetadata>> {
    const providers: Provider[] = await this.providers(profile);
    const fetcher = new UserinfoWorkerFetcher(this.ctx);
    const entries: Array<[ProviderId, UserinfoWithMetadata]> = (
      await Promise.all(
        providers.map(
          async (
            provider: Provider,
          ): Promise<[ProviderId, UserinfoWithMetadata] | undefined> => {
            try {
              const { userinfo, metadata } = await fetcher.fetch(provider);
              return [provider.id, { userinfo, metadata }];
            } catch (err) {
              this.ctx.header("X-Error", `Provider ${provider.id}: ${err}`, {
                append: true,
              });
            }
          },
        ),
      )
    ).filter(
      (
        entry: [ProviderId, UserinfoWithMetadata] | undefined,
      ): entry is [ProviderId, UserinfoWithMetadata] => !!entry,
    );
    return Object.fromEntries(entries);
  }

  protected async providers(profile: Profile): Promise<Provider[]> {
    const store = new ProviderStore(this.kv);
    return Object.values(await store.list()).filter(
      (provider: Provider): boolean => profile.providers.includes(provider.id),
    );
  }
}
