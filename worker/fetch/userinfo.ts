import { UserinfoLocalFetcher } from "@shared/fetch/userinfo";
import type { Provider } from "@shared/schema/provider";
import type { Userinfo } from "@shared/schema/userinfo";
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
