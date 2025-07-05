import type { MihomoProxy } from "../formats";

export type OutboundParams = {
  provider?: string;
  overrides?: OutboundProperties;
  mihomo?: MihomoProxy;
};

type OutboundProperties = {
  name?: string;
  country?: string;
  multiplier?: number;
};

export class Outbound {
  public provider?: string;
  public overrides: OutboundProperties;
  private _mihomo?: MihomoProxy;
  multiplier: number = 1;

  constructor(params: OutboundParams) {
    this.provider = params.provider;
    this.overrides = params.overrides ?? {};
    this._mihomo = params.mihomo;
  }

  get name(): string {
    return this._mihomo!.name;
  }

  get server(): string {
    return this._mihomo!.server;
  }

  // region Formats

  get mihomo(): MihomoProxy | undefined {
    if (!this._mihomo) return undefined;
    return { ...this._mihomo, name: this.name };
  }

  // endregion Formats
}
