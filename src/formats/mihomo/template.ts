import fs from "node:fs/promises";
import * as R from "remeda";
import YAML from "yaml";
import type { Group } from "../../group";
import type { MihomoOutbound } from "./outbound";
import { mihomoParse } from "./parse";
import type {
  Mihomo,
  MihomoNode,
  MihomoProxyGroup,
  MihomoProxyGroupOptions,
} from "./schema";
import { MIHOMO_PROXY_GROUP_SCHEMA } from "./schema";

export class MihomoTemplate {
  template: Mihomo;

  static async load(path: string): Promise<MihomoTemplate> {
    const template: string = await fs.readFile(path, "utf8");
    return new MihomoTemplate(template);
  }

  public constructor(template: string) {
    this.template = mihomoParse(template);
  }

  public render(outbounds: readonly MihomoOutbound[], groups: Group[]): string {
    let config: Mihomo = R.clone(this.template);
    config.proxies = outbounds.map((o: MihomoOutbound): MihomoNode => o.mihomo);
    const groupProxy: MihomoProxyGroup = this.renderGroupProxy();
    config["proxy-groups"] = [groupProxy];
    for (const group of groups) {
      const rendered: MihomoProxyGroup | undefined = this.renderGroup(
        outbounds,
        group,
      );
      if (!rendered) continue;
      config["proxy-groups"].push(rendered);
      groupProxy.proxies.push(rendered.name);
    }
    config = this.sanitize(config);
    return YAML.stringify(config, {
      aliasDuplicateObjects: false,
      sortMapEntries: true,
    });
  }

  protected sanitize(config: Mihomo): Mihomo {
    config = R.omitBy(config, (_value, key: string): boolean =>
      key.startsWith("__"),
    );
    const outboundsNames: Set<string> = new Set([
      "DIRECT",
      "REJECT",
      "REJECT-DROP",
      "PASS",
    ]);
    for (const outbound of config.proxies || [])
      outboundsNames.add(outbound.name);
    for (const group of config["proxy-groups"] || [])
      outboundsNames.add(group.name);
    if (config.rules) {
      config.rules = config.rules.filter((rule: string): boolean => {
        const parts: string[] = rule
          .split(",")
          .filter((p: string): boolean => p.trim() !== "no-resolve");
        const outbound: string = parts[parts.length - 1]!.trim();
        return outboundsNames.has(outbound);
      });
    }
    return config;
  }

  protected renderGroup(
    outbounds: readonly MihomoOutbound[],
    group: Group,
  ): MihomoProxyGroup | undefined {
    const filtered: MihomoOutbound[] = outbounds.filter(group.filter);
    if (filtered.length === 0) return undefined;
    const filteredNames: string[] = filtered.map(
      (o: MihomoOutbound): string => o.prettyName,
    );
    const options: MihomoProxyGroupOptions = {
      name: group.name,
      type: group.type,
      proxies: filteredNames,
      url: group.url,
      icon: group.icon,
    };
    return MIHOMO_PROXY_GROUP_SCHEMA.parse(options);
  }

  protected renderGroupProxy(): MihomoProxyGroup {
    const options: MihomoProxyGroupOptions = {
      name: "PROXY",
      type: "select",
      proxies: [],
      icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Proxy.png",
    };
    return MIHOMO_PROXY_GROUP_SCHEMA.parse(options);
  }
}
