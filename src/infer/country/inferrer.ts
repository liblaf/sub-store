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
      `${outbound.name} => ${outbound.server} => ${this.prettyCountry(result)}`,
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
          logger.debug(`${name} =~ ${pattern} ${this.prettyCountry(country)}`);
          return country;
        }
      }
    }
  }
}

const EXCLUDE_PATTERNS = new Set(["GB"]);

function* patterns(country: Country): Generator<RegExp> {
  for (const name of namesMaybeEmpty(country)) {
    if (!name) continue;
    if (name.match(/[0-9]+/g)) continue;
    if (EXCLUDE_PATTERNS.has(name)) continue;
    if (name.length <= 3) yield new RegExp(name);
    else yield new RegExp(name, "i");
  }
}

function* namesMaybeEmpty(country: Country): Generator<string | undefined> {
  for (const locale of ["en", "zh"]) {
    for (const style of ["narrow", "short", "long"]) {
      const display = new Intl.DisplayNames(locale, {
        style: style as Intl.RelativeTimeFormatStyle,
        type: "region",
      });
      yield display.of(country.cca2);
    }
  }
  yield country.name.common;
  yield country.name.official;
  for (const lang in country.name.native) {
    yield country.name.native[lang]?.common;
    yield country.name.native[lang]?.official;
  }
  yield country.cca2;
  yield country.ccn3;
  yield country.cca3;
  yield country.cioc;
  for (const capital of country.capital) yield capital;
  for (const alt of country.altSpellings) yield alt;
}
