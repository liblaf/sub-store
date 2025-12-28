import type { OutboundWrapper } from "@core/formats/shared/outbound";
import { COUNTRY_UNKNOWN } from "@core/geo/constants";
import twemoji from "@twemoji/api";
import type { Country } from "world-countries";
import type { GroupMeta } from "./abc";
import { Grouper } from "./abc";
import { good } from "./common";

export class CountryGrouper extends Grouper {
  override *group<T = unknown>(
    outbounds: OutboundWrapper<T>[],
  ): Generator<[GroupMeta, OutboundWrapper<T>[]]> {
    const groups: Record<string, [Country, OutboundWrapper<T>[]]> = {};
    for (const outbound of outbounds) {
      if (!good(outbound)) continue;
      const cca2: string = outbound.country.cca2;
      const country = outbound.country;
      const filtered: OutboundWrapper<T>[] = groups[cca2]?.[1] ?? [];
      filtered.push(outbound);
      groups[cca2] = [country, filtered];
    }
    for (const cca2 of Object.keys(groups).sort()) {
      const [country, outbounds] = groups[cca2]!;
      const emoji: string = country.flag;
      const icon: string = "".concat(
        twemoji.base,
        twemoji.size,
        "/",
        twemoji.convert.toCodePoint(emoji),
        twemoji.ext,
      );
      const meta: GroupMeta = {
        name: country.name.common,
        type: country.cca2 === COUNTRY_UNKNOWN.cca2 ? "select" : "url-test",
        emoji,
        icon,
      };
      yield [meta, outbounds];
    }
  }
}
