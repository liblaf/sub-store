import * as R from "remeda";
import YAML from "yaml";
import z from "zod/v4";
import type { Group } from "../../groups";
import type { Outbound } from "../../outbound";
import { parseMihomo } from "./parser";
import {
  MIHOMO_PROXY_GROUP_SCHEMA,
  type Mihomo,
  type MihomoProxy,
  type MihomoProxyGroup,
  type MihomoProxyGroupOptions,
  PORT_SCHEMA,
} from "./schema";

const MIHOMO_TEMPLATE_OPTIONS_SCHEMA = z.object({
  port: PORT_SCHEMA.default(7890),
});

type MihomoTemplateOptions = z.input<typeof MIHOMO_TEMPLATE_OPTIONS_SCHEMA>;
type MihomoTemplateOptionsParsed = z.infer<
  typeof MIHOMO_TEMPLATE_OPTIONS_SCHEMA
>;

export class MihomoTemplate {
  options: MihomoTemplateOptionsParsed;
  template: Mihomo;

  constructor(template: string, options: MihomoTemplateOptions) {
    this.template = parseMihomo(template);
    this.options = MIHOMO_TEMPLATE_OPTIONS_SCHEMA.parse(options);
  }

  async render(outbounds: Outbound[], groups: Group[]): Promise<string> {
    let result: Mihomo = R.clone(this.template);
    result.proxies = outbounds
      .map((outbound: Outbound) => outbound.mihomo)
      .filter((mihomo): mihomo is MihomoProxy => mihomo !== undefined);
    const groupProxy: MihomoProxyGroup = await this.renderGroupProxy();
    result["proxy-groups"] = [groupProxy];
    for (const group of groups) {
      const proxyGroup: MihomoProxyGroup | undefined = await this.renderGroup(
        outbounds,
        group,
      );
      if (!proxyGroup) continue;
      result["proxy-groups"].push(proxyGroup);
      groupProxy.proxies.push(proxyGroup.name);
    }
    result["mixed-port"] = this.options.port;
    result = this.sanitize(result);
    return YAML.stringify(result);
  }

  sanitize(mihomo: Mihomo): Mihomo {
    // TODO: remove rules to nonexistent outbound
    return mihomo;
  }

  protected async renderGroupProxy(): Promise<MihomoProxyGroup> {
    const options: MihomoProxyGroupOptions = {
      name: "PROXY",
      type: "select",
      proxies: [],
    };
    return MIHOMO_PROXY_GROUP_SCHEMA.parse(options);
  }

  protected async renderGroup(
    outbounds: Outbound[],
    group: Group,
  ): Promise<MihomoProxyGroup | undefined> {
    const filtered: Outbound[] = outbounds.filter(group.filter);
    if (!filtered) return undefined;
    const options: MihomoProxyGroupOptions = {
      name: group.name,
      type: group.type,
      proxies: filtered.map((outbound: Outbound): string => outbound.name),
      url: group.url,
      icon: group.icon,
    };
    return MIHOMO_PROXY_GROUP_SCHEMA.parse(options);
  }
}
