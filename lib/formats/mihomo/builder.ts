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
import BUILTIN_TEMPLATE from "@/templates/mihomo.yaml";

import { validateWithMihomo } from "../validate";
import { MIHOMO_CONFIG_SCHEMA } from "./schema";
import type { MihomoConfig, MihomoProxy } from "./schema";

export class MihomoBuilder extends Builder<MihomoProxy> {
  public override async fetch(provider: ProviderOptions): Promise<FetchResult<MihomoProxy>> {
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
    const config = MIHOMO_PROVIDER_SCHEMA.parse(YAML.parse(text));
    const proxies: ProxyWrapper<MihomoProxy>[] = config.proxies.map(
      (proxy: MihomoProxy): ProxyWrapper<MihomoProxy> =>
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
    proxies: ProxyWrapper<MihomoProxy>[],
    infoProxies: ProxyWrapper<MihomoProxy>[],
  ): Promise<string> {
    const body: string = await renderTemplate<MihomoConfig>({
      builtin: {
        url: "builtin://mihomo.yaml",
        value: BUILTIN_TEMPLATE,
      },
      context: createTemplateContext("mihomo", proxies, infoProxies),
      schema: MIHOMO_CONFIG_SCHEMA,
      template: this.template,
    });
    await validateWithMihomo(body);
    return body;
  }

  protected getUrl(provider: ProviderOptions): string {
    if (provider.mihomo) return provider.mihomo;
    if (provider.mixed) return subconvert("clash", provider.mixed);
    throw new Error(`Provider ${provider.name} has no subscription source`);
  }

  protected override createInfoProxy(name: string): MihomoProxy {
    return { name, type: "direct", udp: true };
  }
}

async function validateProviderResponse(response: Response): Promise<void> {
  MIHOMO_PROVIDER_SCHEMA.parse(YAML.parse(await response.text()));
}

const MIHOMO_PROVIDER_SCHEMA = MIHOMO_CONFIG_SCHEMA.pick({ proxies: true });
