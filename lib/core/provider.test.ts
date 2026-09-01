import { describe, expect, test } from "bun:test";

import { PROFILE_SCHEMA } from "./profile";

const id = "0123456789ABCDEFGHJK";

describe("provider input schema", (): void => {
  test("accepts one subscription source with an optional bwcounter", (): void => {
    const result = PROFILE_SCHEMA.safeParse({
      id,
      providers: [
        {
          name: "Example",
          mihomo: "https://example.invalid/subscription",
          bwcounter: "https://example.invalid/bwcounter",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  test("accepts canonical tokens and existing UUID profile IDs", (): void => {
    const provider = { name: "Example", mihomo: "https://example.invalid/subscription" };
    for (const profileId of [id, "00000000-0000-4000-8000-000000000000"]) {
      expect(PROFILE_SCHEMA.safeParse({ id: profileId, providers: [provider] }).success).toBe(true);
    }
  });

  test("rejects malformed profile IDs", (): void => {
    const provider = { name: "Example", mihomo: "https://example.invalid/subscription" };
    for (const profileId of ["too-short", "0123456789ABCDEFGHJI", "0123456789abcdefghjk"]) {
      expect(PROFILE_SCHEMA.safeParse({ id: profileId, providers: [provider] }).success).toBe(
        false,
      );
    }
  });

  test("rejects providers without or with multiple subscription sources", (): void => {
    for (const provider of [
      { name: "Missing" },
      {
        name: "Ambiguous",
        mihomo: "https://example.invalid/mihomo",
        mixed: "https://example.invalid/mixed",
      },
    ]) {
      expect(PROFILE_SCHEMA.safeParse({ id, providers: [provider] }).success).toBe(false);
    }
  });

  test("rejects duplicate provider names", (): void => {
    expect(
      PROFILE_SCHEMA.safeParse({
        id,
        providers: [
          { name: "Duplicate", mihomo: "https://example.invalid/one" },
          { name: "Duplicate", mixed: "https://example.invalid/two" },
        ],
      }).success,
    ).toBe(false);
  });
});
