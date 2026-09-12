import { describe, expect, test } from "bun:test";

import { MihomoBuilder } from "@/lib/formats/mihomo/builder";
import type { MihomoProxy } from "@/lib/formats/mihomo/schema";

import type { FetchResult } from "./builder";
import type { ProviderOptions } from "./provider";
import { createProxyWrapper } from "./proxy";
import type { ProxyWrapper } from "./proxy";

class TestMihomoBuilder extends MihomoBuilder {
  public renderedProxies: ProxyWrapper<MihomoProxy>[] = [];
  public renderedInfoProxies: ProxyWrapper<MihomoProxy>[] = [];

  public override async fetch(provider: ProviderOptions): Promise<FetchResult<MihomoProxy>> {
    if (provider.name === "Alpha") {
      return {
        proxies: [
          createProxyWrapper({
            name: "US Node",
            wrapped: { name: "US Node", type: "direct" },
          }),
          createProxyWrapper({
            name: "Traffic: 50 GB / 100 GB",
            wrapped: { name: "Traffic: 50 GB / 100 GB", type: "direct" },
          }),
        ],
        metadata: {
          date: new Date("2026-08-30T12:00:00Z"),
          usage: {
            upload: 20,
            download: 30,
            total: 100,
            expire: Date.parse("2026-09-30T12:00:00Z") / 1000,
          },
        },
      };
    }
    const usage =
      provider.name === "Beta"
        ? { source: "bwcounter" as const, used: 100, total: 200, resetDay: 15 }
        : provider.name === "Upload"
          ? { upload: 10 }
          : { download: 20, total: 100 };
    return {
      proxies: [
        createProxyWrapper({
          name: `${provider.name} Node`,
          wrapped: { name: `${provider.name} Node`, type: "direct" },
        }),
      ],
      metadata: { date: new Date("2026-08-31T12:00:00Z"), usage },
    };
  }

  public override async render(
    proxies: ProxyWrapper<MihomoProxy>[],
    infoProxies: ProxyWrapper<MihomoProxy>[],
  ): Promise<string> {
    this.renderedProxies = proxies;
    this.renderedInfoProxies = infoProxies;
    return "rendered";
  }
}

type NameOverride = { pattern: string; target: string };

class NameTestMihomoBuilder extends MihomoBuilder {
  public renderedProxies: ProxyWrapper<MihomoProxy>[] = [];

  public constructor(names: string[], overrides: NameOverride[] = []) {
    super({
      profile: {
        id: "00000000-0000-4000-8000-000000000000",
        providers: [
          {
            name: "JMS",
            mihomo: "https://example.invalid/jms",
            override: { "proxy-name": overrides },
          },
        ],
      },
      template: "builtin://mihomo.yaml",
    });
    this.names = names;
  }

  private readonly names: string[];

  public override async fetch(): Promise<FetchResult<MihomoProxy>> {
    return {
      proxies: this.names.map((name: string): ProxyWrapper<MihomoProxy> =>
        createProxyWrapper({ name, wrapped: { name, type: "direct" } }),
      ),
      metadata: { date: new Date("2026-08-31T12:00:00Z") },
    };
  }

  public override async render(proxies: ProxyWrapper<MihomoProxy>[]): Promise<string> {
    this.renderedProxies = proxies;
    return "rendered";
  }
}

describe("Builder provider metadata", (): void => {
  test("adds format-specific info proxies before rendering", async (): Promise<void> => {
    const builder = new TestMihomoBuilder({
      profile: {
        id: "00000000-0000-4000-8000-000000000000",
        providers: [
          { name: "Alpha", mihomo: "https://example.invalid/alpha" },
          {
            name: "Beta",
            mihomo: "https://example.invalid/beta",
            bwcounter: "https://example.invalid/beta/usage",
          },
        ],
      },
      template: "builtin://mihomo.yaml",
    });

    const artifact = await builder.build();

    expect(builder.renderedProxies.map(({ pretty }) => pretty)).toEqual([
      "[Alpha] US Node",
      "[Alpha] Traffic: 50 GB / 100 GB",
      "[Beta] Beta Node",
    ]);
    expect(builder.renderedInfoProxies.map(({ pretty }) => pretty)).toEqual([
      "[Alpha] 🔋 50.0 B / 100 B (50%)",
      "[Alpha] ⏳ 2026-09-30",
      "[Alpha] 🔄 2026-08-30",
      "[Beta] 🔋 100 B / 200 B (50%)",
      "[Beta] 🔄 2026-08-31 · resets day 15",
    ]);
    expect(builder.renderedProxies.every(({ info }) => !info)).toBe(true);
    expect(builder.renderedInfoProxies.every(({ info }) => info)).toBe(true);
    expect(builder.renderedInfoProxies.map(({ wrapped }) => wrapped)).toEqual([
      { name: "[Alpha] 🔋 50.0 B / 100 B (50%)", type: "direct", udp: true },
      { name: "[Alpha] ⏳ 2026-09-30", type: "direct", udp: true },
      { name: "[Alpha] 🔄 2026-08-30", type: "direct", udp: true },
      { name: "[Beta] 🔋 100 B / 200 B (50%)", type: "direct", udp: true },
      { name: "[Beta] 🔄 2026-08-31 · resets day 15", type: "direct", udp: true },
    ]);
    expect(builder.renderedInfoProxies.every(({ country }) => country.cca2 === "UN")).toBe(true);
    expect(artifact.metadata.headers).toEqual({
      "Subscription-Userinfo": "upload=20; download=30; total=100; expire=1790769600",
    });
  });

  test("publishes bwcounter traffic without inventing an expiration", async (): Promise<void> => {
    const builder = new TestMihomoBuilder({
      profile: {
        id: "00000000-0000-4000-8000-000000000000",
        providers: [
          {
            name: "Beta",
            mihomo: "https://example.invalid/beta",
            bwcounter: "https://example.invalid/beta/usage",
          },
        ],
      },
      template: "builtin://mihomo.yaml",
    });

    const artifact = await builder.build();

    expect(builder.renderedInfoProxies.map(({ pretty }) => pretty)).toEqual([
      "[Beta] 🔋 100 B / 200 B (50%)",
      "[Beta] 🔄 2026-08-31 · resets day 15",
    ]);
    expect(artifact.metadata.headers).toEqual({});
  });

  test("does not combine unrelated partial header fields", async (): Promise<void> => {
    const builder = new TestMihomoBuilder({
      profile: {
        id: "00000000-0000-4000-8000-000000000000",
        providers: [
          { name: "Upload", mihomo: "https://example.invalid/upload" },
          { name: "Download", mihomo: "https://example.invalid/download" },
        ],
      },
      template: "builtin://mihomo.yaml",
    });

    const artifact = await builder.build();

    expect(builder.renderedInfoProxies.map(({ pretty }) => pretty)).toEqual([
      "[Upload] 🔄 2026-08-31",
      "[Download] 🔄 2026-08-31",
    ]);
    expect(artifact.metadata.headers).toEqual({});
  });
});

describe("Builder proxy names", (): void => {
  test("matches original JMS names and preserves shared replacement text", async (): Promise<void> => {
    const builder = new NameTestMihomoBuilder(
      [
        "JMS-1234567@c73s1.portablesubmarines.com:8675",
        "JMS-1234567@c73s2.portablesubmarines.com:8675",
      ],
      [
        {
          pattern: ".*s(?<server>1|2|3|801)\\b.*",
          target: "🇺🇸 s$<server> United States",
        },
      ],
    );

    await builder.build();

    expect(builder.renderedProxies.map(({ pretty }) => pretty)).toEqual([
      "[JMS] 🇺🇸 s1 United States",
      "[JMS] 🇺🇸 s2 United States",
    ]);
  });

  test("applies named-capture replacement rules sequentially", async (): Promise<void> => {
    const builder = new NameTestMihomoBuilder(
      ["JMS source · s1 · US"],
      [
        {
          pattern: "^JMS source · (?<server>s\\d+) · (?<country>US)$",
          target: "$<country> $<server>",
        },
        {
          pattern: "^(?<country>US) (?<server>s\\d+)$",
          target: "🇺🇸 $<server> $<country>",
        },
      ],
    );

    await builder.build();

    expect(builder.renderedProxies.map(({ pretty }) => pretty)).toEqual(["[JMS] 🇺🇸 s1 US"]);
  });

  test("preserves any rule match and strips only unmatched names from the original set", async (): Promise<void> => {
    const builder = new NameTestMihomoBuilder(
      [
        "shared JMS s1 US shared",
        "shared Keep shared",
        "shared Alpha shared",
        "shared Beta shared",
      ],
      [
        {
          pattern: "^shared JMS (?<server>s\\d+) (?<country>US) shared$",
          target: "formatted 🇺🇸 $<server> $<country> shared",
        },
        { pattern: "^shared Keep shared$", target: "$&" },
      ],
    );

    await builder.build();

    expect(builder.renderedProxies.map(({ pretty }) => pretty)).toEqual([
      "[JMS] formatted 🇺🇸 s1 US shared",
      "[JMS] shared Keep shared",
      "[JMS] Alpha",
      "[JMS] Beta",
    ]);
  });

  test("retains automatic stripping without rules and preserves a single name", async (): Promise<void> => {
    const multiple = new NameTestMihomoBuilder(["shared Alpha1 shared", "shared Beta2 shared"]);
    const single = new NameTestMihomoBuilder(["shared Only shared"]);

    await Promise.all([multiple.build(), single.build()]);

    expect(multiple.renderedProxies.map(({ pretty }) => pretty)).toEqual([
      "[JMS] Alpha1",
      "[JMS] Beta2",
    ]);
    expect(single.renderedProxies.map(({ pretty }) => pretty)).toEqual([
      "[JMS] shared Only shared",
    ]);
  });

  test("preserves all names when common affixes would consume one", async (): Promise<void> => {
    const builder = new NameTestMihomoBuilder(["abc", "abcabc"]);

    await builder.build();

    expect(builder.renderedProxies.map(({ pretty }) => pretty)).toEqual([
      "[JMS] abc",
      "[JMS] abcabc",
    ]);
  });
});
