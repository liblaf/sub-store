import YAML from "yaml";

import { Builder } from "@/lib/core/builder";
import type { FetchResult } from "@/lib/core/builder";
import type { ProviderOptions } from "@/lib/core/provider";
import type { ProxyWrapper } from "@/lib/core/proxy";
import { createProxyWrapper } from "@/lib/core/proxy";
import { createTemplateContext, renderTemplate } from "@/lib/core/template";
import { usageFromBwcounter, usageFromHeader } from "@/lib/core/usage";
import type { Usage } from "@/lib/core/usage";
import { fetcher, subconvert } from "@/lib/utils";
import BUILTIN_TEMPLATE from "@/templates/stash.yaml";

import { STASH_CONFIG_SCHEMA } from "./schema";
import type { StashConfig, StashProxy } from "./schema";

export class StashBuilder extends Builder<StashProxy> {
  public override async fetch(provider: ProviderOptions): Promise<FetchResult<StashProxy>> {
    const url: string = this.getUrl(provider);
    const response: Response = await fetcher.fetch(
      url,
      {
        headers: {
          "User-Agent": "clash.meta",
        },
      },
      validateProviderResponse,
    );
    const text: string = await response.text();
    const config = STASH_PROVIDER_SCHEMA.parse(YAML.parse(text));
    const proxies: ProxyWrapper<StashProxy>[] = config.proxies.map(
      (proxy: StashProxy): ProxyWrapper<StashProxy> =>
        createProxyWrapper({
          name: proxy.name,
          wrapped: proxy,
        }),
    );
    const date: Date = new Date(response.headers.get("Date") ?? Date.now());
    const usage: Usage | undefined =
      usageFromHeader(response.headers.get("Subscription-Userinfo")) ??
      (await usageFromBwcounter(provider.bwcounter));
    return { proxies, metadata: { date, usage } };
  }

  public override async render(
    proxies: ProxyWrapper<StashProxy>[],
    infoProxies: ProxyWrapper<StashProxy>[],
  ): Promise<string> {
    const body: string = await renderTemplate<StashConfig>({
      builtin: {
        url: "builtin://stash.yaml",
        value: BUILTIN_TEMPLATE,
      },
      context: createTemplateContext("stash", proxies, infoProxies),
      schema: STASH_CONFIG_SCHEMA,
      template: this.template,
    });
    return body;
  }

  protected getUrl(provider: ProviderOptions): string {
    if (provider.mihomo) return provider.mihomo;
    if (provider.mixed) return subconvert("clash", provider.mixed);
    throw new Error(`Provider ${provider.name} has no subscription source`);
  }

  protected override createInfoProxy(name: string): StashProxy {
    return { name, type: "direct", udp: true };
  }
}

async function validateProviderResponse(response: Response): Promise<void> {
  STASH_PROVIDER_SCHEMA.parse(YAML.parse(await response.text()));
}

const STASH_PROVIDER_SCHEMA = STASH_CONFIG_SCHEMA.pick({ proxies: true });
