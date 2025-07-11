import { Cacheable } from "@type-cacheable/core";
import { LRUCacheAdapter } from "@type-cacheable/lru-cache-adapter";
import { LRUCache } from "lru-cache";
import type { Logger } from "tslog";
import type { Country } from "world-countries";
import countries from "world-countries";
import type { GeoIP } from "../../geoip";
import type { Outbound } from "../../outbound";
import { getLogger } from "../../utils";

const logger: Logger<undefined> = getLogger();

const cache: LRUCache<string, Country> = new LRUCache({ max: 512 });
const client: LRUCacheAdapter<Country> = new LRUCacheAdapter(cache);

type CountryInferrerOptions = {
  geoip?: GeoIP;
};

export class CountryInferrer {
  geoip?: GeoIP;

  constructor(options?: CountryInferrerOptions) {
    this.geoip = options?.geoip;
  }

  async infer(outbound: Outbound): Promise<Country | undefined> {
    const result: Country | "Unknown" = await this._infer(outbound);
    if (result === "Unknown") return undefined;
    return result;
  }

  prettyCountry(country: Country | undefined): string {
    if (!country) return "Unknown";
    return `${country.flag} ${country.name.common} (${country.cca2})`;
  }

  // @Cacheable cannot cache undefined, so we use a string literal "Unknown" as sentinel
  @Cacheable({ client })
  protected async _infer(outbound: Outbound): Promise<Country | "Unknown"> {
    let result: Country | undefined;
    result = await this.inferFromName(outbound.name);
    if (result) return result;
    result = await this.inferFromServer(outbound);
    if (result) return result;
    return "Unknown";
  }

  protected async inferFromServer(
    outbound: Outbound,
  ): Promise<Country | undefined> {
    if (!outbound.server) return undefined;
    if (!this.geoip) return undefined;
    const result: Country | undefined = await this.geoip.lookup(
      outbound.server,
    );
    logger.debug(
      `Country: ${outbound.name} => ${outbound.server} => ${this.prettyCountry(result)}`,
    );
    if (result?.cca2 === "CN") return undefined;
    return result;
  }

  protected async inferFromName(name?: string): Promise<Country | undefined> {
    if (!name) return undefined;
    for (const country of countries) {
      if (country.cca2 === "CN") continue;
      for (const pattern of patterns(country)) {
        if (name.match(pattern)) {
          logger.debug(
            `Country: ${name} =~ ${pattern} ${this.prettyCountry(country)}`,
          );
          return country;
        }
      }
    }
  }
}

function* patterns(country: Country): Generator<RegExp> {
  for (const pattern of patternsMaybeEmpty(country)) {
    if (!pattern) continue;
    yield pattern;
  }
}

function* patternsMaybeEmpty(country: Country): Generator<RegExp | undefined> {
  for (const locale of ["en", "zh"]) {
    for (const style of ["narrow", "short", "long"]) {
      const display = new Intl.DisplayNames(locale, {
        style: style as Intl.RelativeTimeFormatStyle,
        type: "region",
      });
      if (style === "narrow" || style === "short") {
        yield patternShort(display.of(country.cca2));
      } else if (style === "long") {
        yield patternLong(display.of(country.cca2));
      }
    }
  }
  yield patternLong(country.name.common);
  yield patternLong(country.name.official);
  for (const lang in country.name.native) {
    yield patternLong(country.name.native[lang]!.common);
    yield patternLong(country.name.native[lang]!.official);
  }
  yield patternShort(country.cca2);
  // yield patternLong(country.ccn3);
  yield patternShort(country.cca3);
  yield patternShort(country.cioc);
  for (const capital of country.capital) yield patternLong(capital);
  // for (const alt of country.altSpellings) yield patternLong(alt);
}

const EXCLUDE_PATTERNS = new Set(["GB"]);

function patternShort(pattern?: string): RegExp | undefined {
  if (!pattern) return undefined;
  if (EXCLUDE_PATTERNS.has(pattern)) return undefined;
  return new RegExp(`\\b${pattern}\\b`);
}

function patternLong(pattern?: string): RegExp | undefined {
  if (!pattern) return undefined;
  return new RegExp(pattern, "i");
}
