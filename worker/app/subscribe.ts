import type { Profile } from "@shared/schema/profile";
import { PROFILE_ID_SCHEMA } from "@shared/schema/profile";
import type { ProviderId } from "@shared/schema/provider";
import type { Userinfo } from "@shared/schema/userinfo";
import { serializeUserinfo } from "@shared/schema/userinfo";
import type { UserinfoWithMetadata } from "@worker/fetch/userinfo";
import { ProfileUserinfoWorkerFetcher } from "@worker/fetch/userinfo";
import { ProfileStore } from "@worker/kv/profile";
import type { Context } from "@worker/types";
import type { RequestMethod } from "@worker/utils/route";
import type { OpenAPIRouteSchema } from "chanfana";
import { NotFoundException, OpenAPIRoute } from "chanfana";
import * as _ from "lodash-es";
import { z } from "zod/v3";

export class Subscribe extends OpenAPIRoute {
  static method: RequestMethod = "get";
  static path: string = "/subscribe/:filename";

  override schema = {
    tags: ["Subscription"],
    summary: "Download subscription",
    request: {
      params: z.object({
        filename: z.string(),
      }),
      query: z.object({
        id: PROFILE_ID_SCHEMA,
      }),
    },
  } satisfies OpenAPIRouteSchema;

  override async handle(c: Context): Promise<Response> {
    const { params, query } = await this.getValidatedData<typeof this.schema>();
    const { filename } = params;
    const { id } = query;
    const store = new ProfileStore(this.kv);
    const profile: Profile | null = await store.read(id);
    if (!profile) throw new NotFoundException();
    const { content, metadata } = await store.artifacts.text(id, filename);
    if (!content || !metadata) throw new NotFoundException();
    await this.userinfo(c, profile);
    c.header("X-Last-Modified", new Date(metadata.mtime).toUTCString());
    if (filename.endsWith(".json"))
      c.header("Content-Type", "application/json");
    if (filename.endsWith(".yaml") || filename.endsWith(".yml"))
      c.header("Content-Type", "application/yaml");
    return c.text(content);
  }

  protected async userinfo(c: Context, profile: Profile): Promise<void> {
    const fetcher = new ProfileUserinfoWorkerFetcher(c);
    const result: Record<ProviderId, UserinfoWithMetadata> =
      await fetcher.fetch(profile);
    const userinfo: Userinfo = {
      download: 0,
      upload: 0,
      total: 0,
      expire: Infinity,
    };
    for (const data of Object.values(result)) {
      userinfo.download! += data.userinfo.download ?? 0;
      userinfo.upload! += data.userinfo.upload ?? 0;
      userinfo.total! += data.userinfo.total ?? 0;
      userinfo.expire! = _.min([userinfo.expire!, data.userinfo.expire!]);
    }
    c.header("Subscription-Userinfo", serializeUserinfo(userinfo));
  }
}
