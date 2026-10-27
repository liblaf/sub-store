import { describe, expect, test } from "bun:test";

import { compilePattern } from "./filter";
import { PROVIDER_SCHEMA } from "./provider";
import type { ProviderOptions } from "./provider";

const url = "https://example.invalid/subscription";

describe("provider input schema", (): void => {
  test("accepts direct YAML URLs with omitted defaults", (): void => {
    expect(PROVIDER_SCHEMA.parse({ url })).toEqual({ url });
  });

  test("accepts native provider filters, headers, and ordered name overrides", (): void => {
    const provider: ProviderOptions = {
      type: "http",
      url,
      headers: { "User-Agent": "mihomo", Accept: ["application/yaml", "text/yaml"] },
      filter: "(?i)united states",
      "exclude-filter": "expired",
      "exclude-type": "ss|vmess",
      override: {
        "additional-prefix": "[Example] ",
        "additional-suffix": " suffix",
        "proxy-name": [{ pattern: "s(?<server>1|2)\\b", target: "s$<server> United States" }],
      },
      "__sub-store": {
        "strip-common-affixes": true,
        bwcounter: "https://example.invalid/usage",
        format: "mixed",
      },
    };
    expect(PROVIDER_SCHEMA.parse(provider)).toEqual(provider);
  });

  test("rejects unsupported or misplaced behavior options", (): void => {
    for (const options of [
      { name: "Example" },
      { mihomo: url },
      { mixed: url },
      { interval: 300 },
      { type: "file" },
      { bwcounter: url },
      { override: { udp: true } },
      { "__sub-store": { mixed: true } },
      { "__sub-store": { format: "unknown" } },
    ]) {
      expect(PROVIDER_SCHEMA.safeParse({ url, ...options }).success).toBe(false);
    }
    expect(PROVIDER_SCHEMA.safeParse({}).success).toBe(false);
    expect(PROVIDER_SCHEMA.safeParse({ url: "not a URL" }).success).toBe(false);
  });

  test("rejects invalid regex without putting its text in validation messages", (): void => {
    for (const options of [
      { filter: "[secret" },
      { "exclude-filter": "[secret" },
      { override: { "proxy-name": [{ pattern: "[secret", target: "replacement" }] } },
    ]) {
      const result = PROVIDER_SCHEMA.safeParse({ url, ...options });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.map(({ message }) => message).join(" ")).toBe(
          "Invalid regular expression",
        );
      }
    }
    expect(() => compilePattern("[secret")).toThrow("Invalid regular expression");
  });

  test("compiles the supported leading case-insensitive modifier", (): void => {
    expect(compilePattern("(?i)united states").test("United States")).toBe(true);
  });
});
