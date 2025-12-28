import { LocalMihomoFetcher } from "@shared/fetch/mihomo";
import type { Provider } from "@shared/schema/provider";
import type { WorkerFetchResult } from "./abc";
import { WorkerFetcher } from "./abc";

export class WorkerMihomoFetcher extends WorkerFetcher<string> {
  override filename: string = "mihomo.yaml";

  override async fetchFromOrigin(
    provider: Provider,
  ): Promise<WorkerFetchResult<string>> {
    const fetcher = new LocalMihomoFetcher(this.sublink);
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
