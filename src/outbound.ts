import type { Country } from "world-countries";
import type { Provider } from "./provider";
import { COUNTRY_UNKNOWN } from "./utils";

export abstract class Outbound {
  public readonly provider: Provider;

  // inference
  public connection: boolean = false;
  public country: Country = COUNTRY_UNKNOWN;
  public emby: boolean = false;
  public info: boolean = false;
  public multiplier: number = 1.0;

  constructor(provider: Provider) {
    this.provider = provider;
  }

  abstract get name(): string;

  abstract get type(): string;

  abstract get server(): string;

  get prettyName(): string {
    let name: string = this.name;
    if (this.provider.name === "JMS") {
      const match = this.name.match(/@(?<name>[\w-]+)/);
      if (match) name = match.groups?.name ?? this.name;
    }
    if (name.startsWith("【")) return `[${this.provider.name}]${name}`;
    return `[${this.provider.name}] ${name}`;
  }
}
