import { expect, spyOn, test } from "bun:test";

import { MihomoBuilder } from "@/lib/formats/mihomo/builder";
import { StashBuilder } from "@/lib/formats/stash/builder";

import { PROFILE_SCHEMA } from "./profile";
import { PROVIDER_SCHEMA } from "./provider";

const id = "0123456789ABCDEFGHJK";

test("validates private metadata and canonicalizes the earlier metadata alias", () => {
  const canonical = PROFILE_SCHEMA.parse({ "__sub-store": { id, target: "stash" } });
  expect(canonical["__sub-store"]).toEqual({ id, target: "stash" });
  expect(PROFILE_SCHEMA.parse({ "sub-store": { id, target: "stash" } })).toEqual(canonical);
  expect(
    PROFILE_SCHEMA.safeParse({ "__sub-store": { id: "invalid", target: "stash" } }).success,
  ).toBe(false);
  expect(PROFILE_SCHEMA.safeParse({ "__sub-store": { id, target: "other" } }).success).toBe(false);
  expect(
    PROFILE_SCHEMA.safeParse({
      "__sub-store": { target: "stash" },
      "sub-store": { target: "mihomo" },
    }).success,
  ).toBe(false);
});

test("provider options use the same private namespace and reject ambiguous aliases", () => {
  const options = {
    "strip-common-affixes": true,
    format: "yaml" as const,
    bwcounter: "https://example.invalid/usage",
  };
  const canonical = PROVIDER_SCHEMA.parse({
    url: "https://example.invalid/sub",
    "__sub-store": options,
  });
  expect(canonical["__sub-store"]).toEqual(options);
  expect(
    PROVIDER_SCHEMA.parse({ url: "https://example.invalid/sub", "sub-store": options }),
  ).toEqual(canonical);
  expect(
    PROVIDER_SCHEMA.safeParse({
      url: "https://example.invalid/sub",
      "__sub-store": {},
      "sub-store": {},
    }).success,
  ).toBe(false);
});

test("both builders reject mismatched metadata before fetching providers", async () => {
  for (const [Builder, declared] of [
    [MihomoBuilder, "stash"],
    [StashBuilder, "mihomo"],
  ] as const) {
    const builder = new Builder({
      profile: PROFILE_SCHEMA.parse({
        "__sub-store": { target: declared },
        "proxy-providers": { Example: { url: "https://example.invalid/sub" } },
      }),
    });
    const fetch = spyOn(builder, "fetch");
    try {
      await expect(builder.build()).rejects.toThrow("requested target");
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  }
});

test("Mihomo variants reject each other's target before fetching providers", async () => {
  for (const target of ["mihomo", "mihomo-smart"] as const) {
    const builder = new MihomoBuilder({
      target,
      profile: PROFILE_SCHEMA.parse({
        "__sub-store": { target: target === "mihomo" ? "mihomo-smart" : "mihomo" },
        "proxy-providers": { Example: { url: "https://example.invalid/sub" } },
      }),
    });
    const fetch = spyOn(builder, "fetch");
    try {
      await expect(builder.build()).rejects.toThrow("requested target");
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  }
});
