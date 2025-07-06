import z from "zod";
import { type Mihomo, type MihomoProxy, parseMihomo } from "../formats";
import { Outbound } from "../outbound";
import { fetcher } from "./fetch";

export const PROVIDER_SCHEMA = z.object({
  name: z.string(),
  free: z.boolean().default(false),
  // subscription format
  mihomo: z
    .object({ url: z.string().url(), ua: z.string().default("clash.meta") })
    .optional(),
  jms: z.object({}).optional(),
});

export type ProviderParams = z.input<typeof PROVIDER_SCHEMA>;

export type ProviderParsed = z.infer<typeof PROVIDER_SCHEMA>;

export class Provider {
  public name: string;
  public free: boolean;
  // subscription format
  public mihomo?: { url: string; ua: string };
  public jms?: any;

  private _mihomo?: Mihomo;

  constructor(params: ProviderParams) {
    const parsed: ProviderParsed = PROVIDER_SCHEMA.parse(params);
    this.name = parsed.name;
    this.free = parsed.free;
    this.mihomo = parsed.mihomo;
    this.jms = parsed.jms;
  }

  async fetchMihomo(): Promise<Mihomo> {
    if (!this._mihomo) {
      let text: string = "";
      if (this.mihomo) {
        text = await fetcher.fetchText(this.mihomo.url, this.mihomo.ua);
      }
      this._mihomo = parseMihomo(text);
    }
    return this._mihomo!;
  }

  async fetchMihomoOutbounds(): Promise<Outbound[]> {
    if (!this._mihomo) {
      let text: string | undefined;
      if (this.mihomo)
        text = await fetcher.fetchText(this.mihomo.url, this.mihomo.ua);
      this._mihomo = parseMihomo(text!);
    }
    return this._mihomo.proxies!.map(
      (proxy: MihomoProxy): Outbound =>
        new Outbound({ provider: this.name, mihomo: proxy }),
    );
  }
}
