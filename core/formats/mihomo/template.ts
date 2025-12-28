import * as fs from "node:fs/promises";
import type { Grouper, GroupMeta } from "@core/group/abc";
import mihomo from "@templates/mihomo.yaml";
import yaml from "js-yaml";
import * as _ from "lodash-es";
import type z from "zod";
import type { MihomoOutboundWrapper } from "./outbound";
import { parseMihomoConfig } from "./parse";
import type { MihomoConfig, MihomoGroup, MihomoOutbound } from "./schema";
import { MIHOMO_GROUP_SCHEMA } from "./schema";

const PATH_TO_TEMPLATE: Record<string, MihomoConfig> = {
  "builtin://mihomo.yaml": mihomo,
};

export class MihomoTemplate {
  static async load(path: string): Promise<MihomoTemplate> {
    let template: MihomoConfig | undefined = PATH_TO_TEMPLATE[path];
    if (!template) {
      const content: string = await fs.readFile(path, "utf-8");
      template = parseMihomoConfig(content);
    }
    return new MihomoTemplate(template);
  }

  constructor(readonly template: MihomoConfig) {}

  render(outbounds: MihomoOutboundWrapper[], groupers: Grouper[]): string {
    const config: MihomoConfig = _.cloneDeep(this.template);
    const defaultGroup: MihomoGroup = this.renderDefaultGroup();
    const groups: MihomoGroup[] = [defaultGroup];
    for (const grouper of groupers) {
      for (const [meta, filtered] of grouper.group(outbounds)) {
        const group: MihomoGroup = this.renderGroup(meta, filtered);
        defaultGroup.proxies.push(group.name);
        groups.push(group);
      }
    }
    config.proxies = outbounds.map(
      (o: MihomoOutboundWrapper): MihomoOutbound => o.render(),
    );
    config["proxy-groups"] = groups;
    return yaml.dump(this.sanitize(config), {
      indent: 2,
      noRefs: true,
      sortKeys: true,
    });
  }

  renderDefaultGroup(): MihomoGroup {
    return MIHOMO_GROUP_SCHEMA.parse({
      name: "PROXY",
      type: "select",
      proxies: [],
    } satisfies z.input<typeof MIHOMO_GROUP_SCHEMA>);
  }

  renderGroup(
    meta: GroupMeta,
    outbounds: MihomoOutboundWrapper[],
  ): MihomoGroup {
    const proxies: string[] = outbounds.map(
      (o: MihomoOutboundWrapper): string => o.name,
    );
    const group: MihomoGroup = MIHOMO_GROUP_SCHEMA.parse({
      name: meta.name,
      type: meta.type,
      proxies,
      url: meta.url,
      "expected-status": meta["expected-status"],
      icon: meta.icon,
    } satisfies z.input<typeof MIHOMO_GROUP_SCHEMA>);
    return group;
  }

  sanitize(config: MihomoConfig): MihomoConfig {
    const rules: string[] = config.rules ?? [];
    const array: string[] = ["DIRECT", "REJECT", "REJECT-DROP", "PASS"];
    for (const outbound of config.proxies ?? []) array.push(outbound.name);
    for (const group of config["proxy-groups"] ?? []) array.push(group.name);
    const proxies: Set<string> = new Set(array);
    config.rules = rules.filter((rule: string): boolean => {
      rule = rule.replace(/,no-resolve$/, "");
      const parts: string[] = rule.split(",");
      const dest: string = parts[parts.length - 1]!.trim();
      return proxies.has(dest);
    });
    return config;
  }
}
