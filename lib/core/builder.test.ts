import { describe, expect, test } from "bun:test";

import { MihomoBuilder } from "@/lib/formats/mihomo/builder";
import type { MihomoProxy } from "@/lib/formats/mihomo/schema";

import type { FetchResult } from "./builder";
import { PROFILE_SCHEMA } from "./profile";
import type { ProviderOptions } from "./provider";
import { createProxyWrapper } from "./proxy";
import type { ProxyWrapper } from "./proxy";

class TestMihomoBuilder extends MihomoBuilder {
  public renderedProxies: ProxyWrapper<MihomoProxy>[] = [];
  public renderedInfoProxies: ProxyWrapper<MihomoProxy>[] = [];

  public override async fetch(provider: ProviderOptions): Promise<FetchResult<MihomoProxy>> {
    const name = new URL(provider.url).pathname
      .slice(1)
      .replace(/^./, (letter) => letter.toUpperCase());
    if (name === "Alpha") {
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
      name === "Beta"
        ? { source: "bwcounter" as const, used: 100, total: 200, resetDay: 15 }
        : name === "Complete"
          ? {
              upload: 5,
              download: 15,
              total: 200,
              expire: Date.parse("2026-09-15T12:00:00Z") / 1000,
            }
          : name === "Upload"
            ? { upload: 10 }
            : { download: 20, total: 100 };
    return {
      proxies: [
        createProxyWrapper({
          name: `${name} Node`,
          wrapped: { name: `${name} Node`, type: "direct" },
        }),
      ],
      metadata: { date: new Date("2026-08-31T12:00:00Z"), usage },
    };
  }

  public override async render(
    providers: ReadonlyMap<string, ProxyWrapper<MihomoProxy>[]>,
    infoProxies: ProxyWrapper<MihomoProxy>[],
  ): Promise<string> {
    this.renderedProxies = [...providers.values()].flat();
    this.renderedInfoProxies = infoProxies;
    return "rendered";
  }
}

describe("Builder provider metadata", (): void => {
  test("adds format-specific info proxies before rendering", async (): Promise<void> => {
    const builder = new TestMihomoBuilder({
      profile: PROFILE_SCHEMA.parse({
        "proxy-providers": {
          Alpha: {
            url: "https://example.invalid/alpha",
            override: { "additional-prefix": "[Alpha] " },
          },
          Beta: {
            url: "https://example.invalid/beta",
            override: { "additional-prefix": "[Beta] " },
            "__sub-store": { bwcounter: "https://example.invalid/beta/usage" },
          },
        },
      }),
    });

    const artifact = await builder.build();

    expect(builder.renderedProxies.map(({ pretty }) => pretty)).toEqual([
      "[Alpha] US Node",
      "[Alpha] Traffic: 50 GB / 100 GB",
      "[Beta] Beta Node",
    ]);
    expect(builder.renderedInfoProxies.map(({ pretty }) => pretty)).toEqual([
      "[Alpha] 📊 50.0 B / 100 B (50%)",
      "[Alpha] ⌛ 2026-09-30",
      "[Alpha] 📥 2026-08-30",
      "[Beta] 📊 100 B / 200 B (50%)",
      "[Beta] 🔁 15",
      "[Beta] 📥 2026-08-31",
    ]);
    expect(builder.renderedProxies.every(({ info }) => !info)).toBe(true);
    expect(builder.renderedInfoProxies.every(({ info }) => info)).toBe(true);
    expect(builder.renderedInfoProxies.map(({ wrapped }) => wrapped)).toEqual([
      { name: "[Alpha] 📊 50.0 B / 100 B (50%)", type: "direct", udp: true },
      { name: "[Alpha] ⌛ 2026-09-30", type: "direct", udp: true },
      { name: "[Alpha] 📥 2026-08-30", type: "direct", udp: true },
      { name: "[Beta] 📊 100 B / 200 B (50%)", type: "direct", udp: true },
      { name: "[Beta] 🔁 15", type: "direct", udp: true },
      { name: "[Beta] 📥 2026-08-31", type: "direct", udp: true },
    ]);
    expect(artifact.metadata.headers).toEqual({
      "Subscription-Userinfo": "upload=20; download=30; total=100; expire=1790769600",
    });
  });

  test("publishes bwcounter traffic without inventing an expiration", async (): Promise<void> => {
    const builder = new TestMihomoBuilder({
      profile: PROFILE_SCHEMA.parse({
        "proxy-providers": {
          Beta: {
            url: "https://example.invalid/beta",
            override: { "additional-prefix": "[Beta] " },
            "__sub-store": { bwcounter: "https://example.invalid/beta/usage" },
          },
        },
      }),
    });

    const artifact = await builder.build();

    expect(builder.renderedInfoProxies.map(({ pretty }) => pretty)).toEqual([
      "[Beta] 📊 100 B / 200 B (50%)",
      "[Beta] 🔁 15",
      "[Beta] 📥 2026-08-31",
    ]);
    expect(artifact.metadata.headers).toEqual({});
  });

  test("sums complete header usage and selects the earliest expiration", async () => {
    const builder = new TestMihomoBuilder({
      profile: PROFILE_SCHEMA.parse({
        "proxy-providers": {
          Alpha: { url: "https://example.invalid/alpha" },
          Complete: { url: "https://example.invalid/complete" },
        },
      }),
    });
    const artifact = await builder.build();
    expect(artifact.metadata.headers).toEqual({
      "Subscription-Userinfo": `upload=25; download=45; total=300; expire=${Date.parse("2026-09-15T12:00:00Z") / 1000}`,
    });
  });

  test("does not combine unrelated partial header fields", async (): Promise<void> => {
    const builder = new TestMihomoBuilder({
      profile: PROFILE_SCHEMA.parse({
        "proxy-providers": {
          Upload: {
            url: "https://example.invalid/upload",
            override: { "additional-prefix": "[Upload] " },
          },
          Download: {
            url: "https://example.invalid/download",
            override: { "additional-prefix": "[Download] " },
          },
        },
      }),
    });

    const artifact = await builder.build();

    expect(builder.renderedInfoProxies.map(({ pretty }) => pretty)).toEqual([
      "[Upload] 📥 2026-08-31",
      "[Download] 📥 2026-08-31",
    ]);
    expect(artifact.metadata.headers).toEqual({});
  });
});
