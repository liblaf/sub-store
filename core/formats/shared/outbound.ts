import { COUNTRY_UNKNOWN } from "@core/geo/constants";
import type { Provider } from "@shared/schema/provider";
import type { Country } from "world-countries";

export abstract class OutboundWrapper<T = unknown> {
  // metadata
  country: Country = COUNTRY_UNKNOWN;
  emby: boolean = false;
  info: boolean = false;
  multiplier: number = 1.0;
  [key: string]: any;

  constructor(
    public wrapped: T,
    public provider: Provider,
  ) {}

  abstract get name(): string;
  abstract get server(): string;
  abstract get type(): string;

  get prettyName(): string {
    let name: string = this.name;
    const match: RegExpMatchArray | null = this.name.match(/@(?<name>[\w-]+)/);
    name = match?.groups?.name ?? this.name;
    if (name.startsWith("【")) return `[${this.provider.id}]${name}`;
    return `[${this.provider.id}] ${name}`;
  }

  abstract render(): T;
}
