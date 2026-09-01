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
      "Alpha 🔋 50.0 B / 100 B (50%)",
      "Alpha ⏳ 2026-09-30",
      "Alpha 🔄 2026-08-30",
      "Beta 🔋 100 B / 200 B (50%)",
      "Beta 🔄 2026-08-31 · resets day 15",
    ]);
    expect(builder.renderedProxies.every(({ info }) => !info)).toBe(true);
    expect(builder.renderedInfoProxies.every(({ info }) => info)).toBe(true);
    expect(builder.renderedInfoProxies.map(({ wrapped }) => wrapped)).toEqual([
      { name: "Alpha 🔋 50.0 B / 100 B (50%)", type: "direct", udp: true },
      { name: "Alpha ⏳ 2026-09-30", type: "direct", udp: true },
      { name: "Alpha 🔄 2026-08-30", type: "direct", udp: true },
      { name: "Beta 🔋 100 B / 200 B (50%)", type: "direct", udp: true },
      { name: "Beta 🔄 2026-08-31 · resets day 15", type: "direct", udp: true },
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
      "Beta 🔋 100 B / 200 B (50%)",
      "Beta 🔄 2026-08-31 · resets day 15",
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
      "Upload 🔄 2026-08-31",
      "Download 🔄 2026-08-31",
    ]);
    expect(artifact.metadata.headers).toEqual({});
  });
});
