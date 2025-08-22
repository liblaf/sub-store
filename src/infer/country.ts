import consola from "consola";
import countries, { type Country } from "world-countries";
import type { Outbound } from "../outbound";
import { COUNTRY_UNKNOWN } from "../outbound";
import { Inferrer } from "./abc";

export class InferrerCountry extends Inferrer {
  public override async infer<T extends Outbound>(outbound: T): Promise<T> {
    if (outbound.country.cca2 === COUNTRY_UNKNOWN.cca2)
      outbound = this.inferFromName(outbound);
    if (outbound.country.cca2 === COUNTRY_UNKNOWN.cca2)
      outbound.country = COUNTRY_UNKNOWN;
    return outbound;
  }

  protected inferFromName<T extends Outbound>(outbound: T): T {
    const name: string = outbound.name;
    for (const country of countries) {
      if (country.cca2 === "CN") continue;
      for (const pattern of patterns(country)) {
        if (!pattern) continue;
        if (pattern.test(name)) {
          consola.debug(`${name} ~ ${pattern} (${prettyCountry(country)})`);
          outbound.country = country;
          return outbound;
        }
      }
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
