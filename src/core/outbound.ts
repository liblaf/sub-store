import type { Country } from "world-countries";
import { COUNTRY_UNKNOWN } from "../utils";
import type { Provider } from "./provider";

export abstract class Outbound {
  public readonly provider: Provider;

  // metadata
  public country: Country = COUNTRY_UNKNOWN;
  public info: boolean = false;
  [key: string]: any;

  constructor(provider: Provider) {
    this.provider = provider;
  }

  abstract get name(): string;

  abstract get type(): string;

  abstract get server(): string;

  get prettyName(): string {
    let name: string = this.name;
    if (this.provider.name === "JMS") {
      const match: RegExpMatchArray | null =
        this.name.match(/@(?<name>[\w-]+)/);
      if (match) name = match.groups?.name ?? this.name;
    }
    if (name.startsWith("【")) return `[${this.provider.name}]${name}`;
    return `[${this.provider.name}] ${name}`;
  }
}
