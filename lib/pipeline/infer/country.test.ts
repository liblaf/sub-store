import { describe, expect, test } from "bun:test";

import type { Country } from "world-countries";

import { CCA2_TO_COUNTRY, COUNTRY_UNKNOWN, inferCountry } from "./country";

type Proxy = {
  country: Country;
  info: boolean;
  name: string;
};

function proxy(name: string): Proxy {
  return { country: COUNTRY_UNKNOWN, info: false, name };
}

describe("inferCountry", (): void => {
  test("groups simplified and traditional Chinese Taiwan node names", (): void => {
    const proxies = inferCountry([
      proxy("🇨🇳台湾专线01|BGP|流媒体"),
      proxy("🇨🇳台灣專線01|BGP|串流媒體"),
    ]);

    expect(proxies.map(({ country }) => country)).toEqual([
      CCA2_TO_COUNTRY.TW!,
      CCA2_TO_COUNTRY.TW!,
    ]);
  });
});
