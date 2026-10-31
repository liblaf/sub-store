import { Builder, unwrapProxies } from "@/lib/core/builder";
import type { BuildOptions } from "@/lib/core/builder";
import type { ProxyWrapper } from "@/lib/core/proxy";
import { renderProfile } from "@/lib/core/template";

import { validateWithMihomo } from "../validate";
import { MIHOMO_CONFIG_SCHEMA, MIHOMO_SMART_CONFIG_SCHEMA } from "./schema";
import type { MihomoProxy } from "./schema";

export class MihomoBuilder extends Builder<MihomoProxy> {
  public override readonly target: "mihomo" | "mihomo-smart";
  protected override providerSchema = MIHOMO_CONFIG_SCHEMA.pick({ proxies: true });

  public constructor(options: BuildOptions & { target?: "mihomo" | "mihomo-smart" }) {
    super(options);
    this.target = options.target ?? "mihomo";
  }

  public override async render(
    providers: ReadonlyMap<string, ProxyWrapper<MihomoProxy>[]>,
    infoProxies: ProxyWrapper<MihomoProxy>[],
  ): Promise<string> {
    const body = renderProfile({
      profile: this.profile,
      providers: new Map([...providers].map(([name, proxies]) => [name, unwrapProxies(proxies)])),
      infoProxies: unwrapProxies(infoProxies),
      schema: this.target === "mihomo-smart" ? MIHOMO_SMART_CONFIG_SCHEMA : MIHOMO_CONFIG_SCHEMA,
    });
    await validateWithMihomo(body, this.target);
    return body;
  }

  protected override createInfoProxy(name: string): MihomoProxy {
    return { name, type: "direct", udp: true };
  }
}
