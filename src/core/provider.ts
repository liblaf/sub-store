import consola from "consola";
import ky from "ky";
import { z } from "zod";
import type { Mihomo, MihomoNode } from "../formats";
import { MihomoOutbound, mihomoParse } from "../formats";
import { sublinkClashUrl } from "../utils";

export const PROVIDER_SCHEMA: z.ZodObject<{
  name: z.ZodString;
  free: z.ZodDefault<z.ZodBoolean>;
  jms: z.ZodOptional<z.ZodObject<{ url: z.ZodURL }>>;
  mihomo: z.ZodOptional<z.ZodObject<{ url: z.ZodURL }>>;
}> = z.object({
  name: z.string(),
  free: z.boolean().default(false),
  jms: z.object({ url: z.url() }).optional(),
  mihomo: z.object({ url: z.url() }).optional(),
});
export type ProviderOptions = z.input<typeof PROVIDER_SCHEMA>;

export class Provider {
  public readonly name: string;
  public readonly jms?: { url: string };
  public readonly mihomo?: { url: string };

  public constructor(options: ProviderOptions) {
    const { name, jms, mihomo } = PROVIDER_SCHEMA.parse(options);
    this.name = name;
    this.jms = jms;
    this.mihomo = mihomo;
  }

  public async fetchOutboundsMihomo(): Promise<MihomoOutbound[]> {
    const url: string | URL | undefined = this.getMihomoURL();
    if (!url) return [];
    const headers = new Headers({ "User-Agent": "clash.meta" });
    const text: string = await ky.get(url, { headers }).text();
    const config: Mihomo = mihomoParse(text);
    return config.proxies!.map(
      (proxy: MihomoNode): MihomoOutbound => new MihomoOutbound(proxy, this),
    );
  }

  protected warnFormat(format: string): void {
    consola.warn(`Provider '${this.name}' does not support '${format}'`);
  }

  protected getMihomoURL(): string | URL | undefined {
    if (this.mihomo) return this.mihomo.url;
    if (this.jms) return sublinkClashUrl(this.jms.url);
    this.warnFormat("mihomo");
    return undefined;
  }
}
