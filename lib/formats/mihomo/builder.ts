import fs from "node:fs/promises";

import * as _ from "lodash-es";
import YAML from "yaml";

import { Builder } from "@/lib/core/builder";
import type { FetchResult } from "@/lib/core/builder";
import type { ProviderOptions } from "@/lib/core/provider";
import type { ProxyWrapper } from "@/lib/core/proxy";
import { createProxyWrapper } from "@/lib/core/proxy";
import { usageFromBwcounter, usageFromHeader } from "@/lib/core/usage";
import type { Usage } from "@/lib/core/usage";
import type { Group } from "@/lib/groups";
import { COUNTRY_UNKNOWN } from "@/lib/pipeline/infer/country";
import { fetcher, subconvert, getName, getPretty } from "@/lib/utils";
import BUILTIN_TEMPLATE from "@/templates/mihomo.yaml";

import type { MihomoConfig, MihomoProxy } from "./schema";

export class MihomoBuilder extends Builder<MihomoProxy> {
  public override async fetch(provider: ProviderOptions): Promise<FetchResult<MihomoProxy>> {
    const url: string = this.getUrl(provider);
    const response: Response = await fetcher.fetch(url, {
      headers: {
        "User-Agent": "clash.meta",
      },
    });
    const text: string = await response.text();
    const config: MihomoConfig = YAML.parse(text);
    const proxies: ProxyWrapper<MihomoProxy>[] = config.proxies.map(
      (proxy: MihomoProxy): ProxyWrapper<MihomoProxy> =>
        createProxyWrapper({
          name: proxy.name,
          wrapped: proxy,
        }),
    );
    let usage: Usage = {
      ...(await usageFromBwcounter(provider.bwcounter)),
      ...usageFromHeader(response.headers.get("Subscription-Userinfo")),
    };
    return { proxies, usage };
  }

  public override proxyFromName(name: string): ProxyWrapper<MihomoProxy> {
    return createProxyWrapper({
      name,
      wrapped: {
        name,
        type: "direct",
      } satisfies MihomoProxy,
      country: COUNTRY_UNKNOWN,
      info: true,
    });
  }

  public override async render(
    proxies: ProxyWrapper<MihomoProxy>[],
    groups: Group<MihomoProxy>[],
  ): Promise<string> {
    let config: MihomoConfig = await loadTemplate(this.template);
    config.proxies = proxies.map(
      (wrapper: ProxyWrapper<MihomoProxy>): MihomoProxy => ({
        ...wrapper.wrapped,
        name: wrapper.pretty,
      }),
    );
    config["proxy-groups"] = [
      {
        name: "PROXY",
        type: "select",
        proxies: groups.map(getName),
        url: "https://cp.cloudflare.com",
        "expected-status": 204,
        icon: "TODO",
      },
    ];
    for (const group of groups) {
      if (group.proxies.length === 0) continue;
      config["proxy-groups"].push({
        name: group.name,
        type: group.type,
        proxies: group.proxies.map(getPretty),
        url: group.url,
        "expected-status": group["expected-status"],
        icon: group.icon,
      });
    }
    config = _.omitBy(config, (_value: any, key: string): boolean =>
      key.startsWith("__"),
    ) as MihomoConfig;
    return YAML.stringify(config, { aliasDuplicateObjects: false });
  }

  protected getUrl(provider: ProviderOptions): string {
    if (provider.mihomo) return provider.mihomo;
    if (provider.mixed) return subconvert("clash", provider.mixed);
    throw new Error("TODO");
  }
}

async function loadTemplate(template: string): Promise<MihomoConfig> {
  if (template === "builtin://mihomo.yaml") return BUILTIN_TEMPLATE;
  return YAML.parse(await fs.readFile(template, "utf-8"));
}
