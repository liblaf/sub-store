import fs from "node:fs/promises";

import * as _ from "lodash-es";
import YAML from "yaml";

import { Builder } from "@/lib/core/builder";
import type { FetchResult } from "@/lib/core/builder";
import type { ProviderOptions } from "@/lib/core/provider";
import type { ProxyWrapper } from "@/lib/core/proxy";
import { createProxyWrapper } from "@/lib/core/proxy";
import { usageFromBwcounter, usageFromHeader } from "@/lib/core/usage";
import type { SubscriptionUserinfo } from "@/lib/core/usage";
import type { Group } from "@/lib/groups";
import { COUNTRY_UNKNOWN } from "@/lib/pipeline/infer/country";
import { fetcher, subconvert } from "@/lib/utils";
import BUILTIN_TEMPLATE from "@/templates/stash.yaml";

import type { StashConfig, StashProxy, StashProxyGroup } from "./schema";

export class StashBuilder extends Builder<StashProxy> {
  public override async fetch(provider: ProviderOptions): Promise<FetchResult<StashProxy>> {
    const url: string = this.getUrl(provider);
    const response: Response = await fetcher.fetch(url, {
      headers: {
        "User-Agent": "clash.meta",
      },
    });
    const text: string = await response.text();
    const config: StashConfig = YAML.parse(text);
    const proxies: ProxyWrapper<StashProxy>[] = config.proxies.map(
      (proxy: StashProxy): ProxyWrapper<StashProxy> =>
        createProxyWrapper({
          name: proxy.name,
          wrapped: proxy,
        }),
    );
    const date: Date = new Date(response.headers.get("Date") ?? Date.now());
    let usage: SubscriptionUserinfo | undefined =
      usageFromHeader(response.headers.get("Subscription-Userinfo")) ??
      (await usageFromBwcounter(provider.bwcounter));
    return { proxies, metadata: { date, usage } };
  }

  public override proxyFromName(name: string): ProxyWrapper<StashProxy> {
    return createProxyWrapper({
      name,
      wrapped: {
        name,
        type: "direct",
      } satisfies StashProxy,
      country: COUNTRY_UNKNOWN,
      info: true,
    });
  }

  public override async render(
    proxies: ProxyWrapper<StashProxy>[],
    groups: Group<StashProxy>[],
  ): Promise<string> {
    let config: StashConfig = await loadTemplate(this.template);
    config.proxies = proxies.map(
      (wrapper: ProxyWrapper<StashProxy>): StashProxy => ({
        ...wrapper.wrapped,
        name: wrapper.pretty,
      }),
    );
    for (const group of groups) {
      if (group.proxies.length === 0) continue;
      config["proxy-groups"][0]!.proxies.push(group.name);
      config["proxy-groups"].push(this.renderGroup(group));
    }
    config = _.omitBy(config, (_value: any, key: string): boolean =>
      key.startsWith("__"),
    ) as StashConfig;
    return YAML.stringify(config, { aliasDuplicateObjects: false });
  }

  protected getUrl(provider: ProviderOptions): string {
    if (provider.mihomo) return provider.mihomo;
    if (provider.mixed) return subconvert("clash", provider.mixed);
    throw new Error("TODO");
  }

  protected renderGroup(group: Group<StashProxy>): StashProxyGroup {
    // TODO: If a proxy is referenced by multiple policy groups, the delay
    // testing results for this proxy will be shared among the policy groups. If
    // you want a proxy to use different delay testing parameters in different
    // policy groups, manually create multiple proxies.
    // ref: <https://stash.wiki/en/proxy-protocols/proxy-benchmark>
    return {
      name: group.name,
      type: group.type,
      proxies: group.proxies.map((wrapper: ProxyWrapper<StashProxy>): string => wrapper.pretty),
      "benchmark-url": group.url,
      lazy: true,
      icon: group.icon,
      // for compatibility with Stash
      url: group.url,
      "expected-status": group["expected-status"],
    };
  }
}

async function loadTemplate(template: string): Promise<StashConfig> {
  if (template === "builtin://stash.yaml") return BUILTIN_TEMPLATE;
  return YAML.parse(await fs.readFile(template, "utf-8"));
}
