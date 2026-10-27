import { describe, expect, test } from "bun:test";

import type { ProviderOptions } from "../../core/provider";
import { nameNormalize, normalizeProviderProxies } from "./normalize";
import { nameStripCommonAffixes } from "./strip-common-affixes";

const base: ProviderOptions = { url: "https://example.invalid/subscription" };
const proxies = (...names: string[]): { name: string; pretty: string }[] =>
  names.map((name: string) => ({ name, pretty: name }));
const names = (items: { name: string }[]): string[] => items.map(({ name }) => name);

describe("normalizeProviderProxies", (): void => {
  test("preserves names by default with no implicit provider labels", (): void => {
    expect(
      names(normalizeProviderProxies(proxies("shared Alpha shared", "shared Beta shared"), base)),
    ).toEqual(["shared Alpha shared", "shared Beta shared"]);
  });

  test("strips first, runs ordered replacements, then adds affixes", (): void => {
    const result = normalizeProviderProxies(
      proxies("shared Alpha1 shared", "shared Beta2 shared"),
      {
        ...base,
        "__sub-store": { "strip-common-affixes": true },
        override: {
          "proxy-name": [
            { pattern: "^Alpha1$", target: "First" },
            { pattern: "^First$", target: "Final" },
          ],
          "additional-prefix": "[Example] ",
          "additional-suffix": "!",
        },
      },
    );
    expect(names(result)).toEqual(["[Example] Final!", "[Example] Beta2!"]);
    expect(result.map(({ pretty }) => pretty)).toEqual(names(result));
  });

  test("uses JavaScript named capture replacements", (): void => {
    const result = normalizeProviderProxies(proxies("US s801 node", "Japan s4 node"), {
      ...base,
      override: {
        "additional-prefix": "[JMS] ",
        "proxy-name": [
          { pattern: ".*s(?<server>1|2|3|801)\\b.*", target: "🇺🇸 s$<server> United States" },
          { pattern: ".*s(?<server>4)\\b.*", target: "🇯🇵 s$<server> Japan" },
        ],
      },
    });
    expect(names(result)).toEqual(["[JMS] 🇺🇸 s801 United States", "[JMS] 🇯🇵 s4 Japan"]);
  });

  test("strips original country text when explicitly requested", (): void => {
    expect(
      names(
        normalizeProviderProxies(proxies("Taiwan A", "Taiwan B"), {
          ...base,
          "__sub-store": { "strip-common-affixes": true },
        }),
      ),
    ).toEqual(["A", "B"]);
  });

  test("explicit replacements run without automatic stripping", (): void => {
    expect(
      names(nameNormalize(proxies("US Node 01", "US Node 02"), [{ pattern: "01$", target: "A" }])),
    ).toEqual(["US Node A", "US Node 02"]);
  });
});

describe("nameStripCommonAffixes", (): void => {
  test("uses the entire original list", (): void => {
    expect(
      names(nameStripCommonAffixes(proxies("pre A suffix", "pre B suffix", "C suffix"))),
    ).toEqual(["pre A", "pre B", "C"]);
  });

  test("preserves empty lists, a singleton, identical names, and overlapping affixes", (): void => {
    for (const original of [[], ["only"], ["same", "same"], ["a", "aa"], ["", "A"]]) {
      expect(names(nameStripCommonAffixes(proxies(...original)))).toEqual(original);
    }
  });

  test("does not split emoji when different code points share a UTF-16 surrogate", (): void => {
    expect(names(nameStripCommonAffixes(proxies("prefix 😀 suffix", "prefix 😁 suffix")))).toEqual([
      "😀",
      "😁",
    ]);
    expect(names(nameStripCommonAffixes(proxies("😀 A 🇺🇸", "😀 B 🇺🇸")))).toEqual(["A", "B"]);
  });
});
