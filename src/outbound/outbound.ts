import type { MihomoProxy } from "../formats";
import type { Connection } from "./typed";

export type OutboundParams = {
  provider?: string;
  overrides?: OutboundProperties;
  mihomo?: MihomoProxy;
};

type OutboundProperties = {
  name?: string;
  country?: string;
  emby?: boolean;
  multiplier?: number;
};

export class Outbound {
  provider?: string;
  overrides: OutboundProperties;

  connection?: Connection;
  country?: string;
  emby: boolean = false;
  multiplier: number = 1.0;

  private _mihomo?: MihomoProxy;

  constructor(params: OutboundParams) {
    this.provider = params.provider;
    this.overrides = params.overrides ?? {};
    this._mihomo = params.mihomo;
  }

  get name(): string {
    return this._mihomo!.name;
  }

  get prettyName(): string {
    if (this.provider) return `[${this.provider}]${this.name}`;
    return this.name;
  }

  get server(): string {
    return this._mihomo!.server;
  }

  // region Formats

  get mihomo(): MihomoProxy | undefined {
    if (!this._mihomo) return undefined;
    return { ...this._mihomo, name: this.prettyName };
  }

  // endregion Formats
}
