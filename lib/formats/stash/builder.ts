import { Builder, unwrapProxies } from "@/lib/core/builder";
import type { ProxyWrapper } from "@/lib/core/proxy";
import { renderProfile } from "@/lib/core/template";

import { STASH_CONFIG_SCHEMA } from "./schema";
import type { StashProxy } from "./schema";

export class StashBuilder extends Builder<StashProxy> {
  public override readonly target = "stash";
  protected override providerSchema = STASH_CONFIG_SCHEMA.pick({ proxies: true });

  public override async render(
    providers: ReadonlyMap<string, ProxyWrapper<StashProxy>[]>,
    infoProxies: ProxyWrapper<StashProxy>[],
  ): Promise<string> {
    return renderProfile({
      profile: this.profile,
      providers: new Map([...providers].map(([name, proxies]) => [name, unwrapProxies(proxies)])),
      infoProxies: unwrapProxies(infoProxies),
      schema: STASH_CONFIG_SCHEMA,
    });
  }

  protected override createInfoProxy(name: string): StashProxy {
    return { name, type: "direct", udp: true };
  }
}
