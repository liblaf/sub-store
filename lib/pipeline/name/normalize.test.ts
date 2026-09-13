import { describe, expect, test } from "bun:test";

import type { Country } from "world-countries";

import { COUNTRY_UNKNOWN, inferCountry } from "../infer/country";
import { nameNormalize } from "./normalize";

type Proxy = {
  country: Country;
  info: boolean;
  name: string;
};

function proxy(name: string): Proxy {
  return { country: COUNTRY_UNKNOWN, info: false, name };
}

describe("nameNormalize", (): void => {
  test("preserves country names that automatic stripping would remove", (): void => {
    const proxies = nameNormalize(
      [proxy("🇨🇳台湾专线01|BGP|流媒体"), proxy("🇨🇳台湾专线02|BGP|流媒体")],
      [],
    );

    expect(proxies.map(({ name }) => name)).toEqual([
      "🇨🇳台湾专线01|BGP|流媒体",
      "🇨🇳台湾专线02|BGP|流媒体",
    ]);
    expect(inferCountry(proxies).map(({ country }) => country.cca2)).toEqual(["TW", "TW"]);
  });

  test("strips neutral common affixes", (): void => {
    const proxies = nameNormalize(
      [proxy("shared Alpha1 shared"), proxy("shared Beta2 shared")],
      [],
    );

    expect(proxies.map(({ name }) => name)).toEqual(["Alpha1", "Beta2"]);
  });

  test("keeps explicit country-changing overrides", (): void => {
    const proxies = nameNormalize(
      [proxy("US Node 01"), proxy("US Node 02")],
      [{ pattern: "^US Node 01$", target: "Taiwan override" }],
    );

    expect(proxies.map(({ name }) => name)).toEqual(["Taiwan override", "US Node 02"]);
    expect(inferCountry(proxies).map(({ country }) => country.cca2)).toEqual(["TW", "US"]);
  });
});
