import consola from "consola";
import countries, { type Country } from "world-countries";
import { type ApiResponse, GeoIP } from "../geoip";
import type { Outbound } from "../outbound";
import { COUNTRY_UNKNOWN, lookupCountry } from "../utils";
import { Inferrer } from "./abc";

export class InferrerCountry extends Inferrer {
  private readonly geoip: GeoIP = new GeoIP();

  public override async infer<T extends Outbound>(outbound: T): Promise<T> {
    if (outbound.emby || outbound.info) {
      outbound.country = COUNTRY_UNKNOWN;
      return outbound;
    }
    if (outbound.country.cca2 === COUNTRY_UNKNOWN.cca2)
      outbound = this.inferFromName(outbound);
    if (outbound.country.cca2 === COUNTRY_UNKNOWN.cca2)
      outbound = await this.inferFromServer(outbound);
    if (outbound.country.cca2 === COUNTRY_UNKNOWN.cca2) {
      consola.fail(
        `${outbound.prettyName} (${prettyCountry(outbound.country)})`,
      );
    }
    return outbound;
  }

  protected inferFromName<T extends Outbound>(outbound: T): T {
    const name: string = outbound.name;
    for (const country of countries) {
      if (country.cca2 === "CN") continue;
      for (const pattern of patterns(country)) {
        if (!pattern) continue;
        if (pattern.test(name)) {
          consola.success(
            `${outbound.prettyName} ~ ${pattern} (${prettyCountry(country)})`,
          );
          outbound.country = country;
          return outbound;
        }
      }
    }
    return outbound;
  }

  protected async inferFromServer<T extends Outbound>(outbound: T): Promise<T> {
    const response: ApiResponse = await this.geoip.lookup(outbound.server);
    if (response.location?.country_code) {
      outbound.country =
        lookupCountry(response.location.country_code) || COUNTRY_UNKNOWN;
    } else {
      outbound.country = COUNTRY_UNKNOWN;
    }
    if (outbound.country.cca2 !== COUNTRY_UNKNOWN.cca2) {
      consola.success(
        `${outbound.prettyName} -> ${response.ip} (${prettyCountry(outbound.country)})`,
      );
    }
    return outbound;
  }
}

function* patterns(country: Country): Generator<RegExp | undefined> {
  const EXCLUDE_PATTERNS = new Set([
    "GB", // gigabyte
  ]);

  function short(pattern?: string): RegExp | undefined {
    if (!pattern) return undefined;
    if (EXCLUDE_PATTERNS.has(pattern)) return undefined;
    return new RegExp(`\\b${pattern}\\b`);
  }

  function long(pattern?: string): RegExp | undefined {
    if (!pattern) return undefined;
    if (EXCLUDE_PATTERNS.has(pattern)) return undefined;
    return new RegExp(pattern, "iu");
  }

  for (const locale of ["en", "zh"]) {
    for (const style of ["narrow", "short", "long"]) {
      const display = new Intl.DisplayNames(locale, {
        style: style as Intl.RelativeTimeFormatStyle,
        type: "region",
      });
      if (style === "narrow" || style === "short") {
        yield short(display.of(country.cca2));
      } else if (style === "long") {
        yield long(display.of(country.cca2));
      }
    }
  }
  yield long(country.name.common);
  yield long(country.name.official);
  for (const lang in country.name.native) {
    yield long(country.name.native[lang]!.common);
    yield long(country.name.native[lang]!.official);
  }
  yield short(country.cca2);
  // yield long(country.ccn3);
  yield short(country.cca3);
  yield short(country.cioc);
  for (const capital of country.capital) yield long(capital);
  // for (const alt of country.altSpellings) yield long(alt);
  yield long(country.flag);
}

function prettyCountry(country: Country): string {
  return `${country.flag} ${country.name.common} (${country.cca2})`;
}
