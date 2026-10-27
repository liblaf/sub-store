import { describe, expect, test } from "bun:test";

import YAML from "yaml";

import { StashBuilder } from "@/lib/formats/stash/builder";
import type { StashProxy } from "@/lib/formats/stash/schema";

import type { BuildOptions, FetchResult } from "./builder";
import { PROFILE_SCHEMA } from "./profile";
import { createProxyWrapper } from "./proxy";
import { compileProfile } from "./template";

class ChainBuilder extends StashBuilder {
  public constructor(
    options: BuildOptions,
    private readonly nodes: StashProxy[],
  ) {
    super(options);
  }

  public override async fetch(): Promise<FetchResult<StashProxy>> {
    return {
      proxies: this.nodes.map((node) =>
        createProxyWrapper({ name: node.name, wrapped: { ...node } }),
      ),
      metadata: { date: new Date("2026-10-27T00:00:00Z") },
    };
  }
}

const chain: StashProxy[] = [
  { name: "upstream", type: "direct" },
  { name: "exit", type: "direct", "dialer-proxy": "upstream" },
];

function providerProfile(provider: Record<string, unknown> = {}) {
  return PROFILE_SCHEMA.parse({
    "proxy-providers": { Demo: { url: "https://example.invalid/demo", ...provider } },
    "proxy-groups": [{ name: "Route", type: "select", use: ["Demo"] }],
    rules: ["MATCH,Route"],
  });
}

describe("native Stash dialer chains", () => {
  test("rewrites provider-local dialers after prefix and suffix overrides", async () => {
    const profile = providerProfile({
      override: { "additional-prefix": "Demo ", "additional-suffix": " final" },
    });
    const artifact = await new ChainBuilder({ profile }, chain).build();
    const config = YAML.parse(artifact.body) as { proxies: StashProxy[] };
    expect(config.proxies.find(({ name }) => name === "Demo exit final")).toMatchObject({
      "dialer-proxy": "Demo upstream final",
    });
    expect(config.proxies.some(({ name }) => name === "Demo upstream final")).toBe(true);
  });

  test("uses the final name after ordered replacements", async () => {
    const profile = providerProfile({
      override: {
        "proxy-name": [
          { pattern: "^upstream$", target: "relay" },
          { pattern: "^relay$", target: "gateway" },
        ],
        "additional-prefix": "Demo ",
      },
    });
    const artifact = await new ChainBuilder({ profile }, chain).build();
    const config = YAML.parse(artifact.body) as { proxies: StashProxy[] };
    expect(config.proxies.find(({ name }) => name === "Demo exit")).toMatchObject({
      "dialer-proxy": "Demo gateway",
    });
    expect(config.proxies.some(({ name }) => name === "Demo gateway")).toBe(true);
  });

  test("rejects a dialer target removed by provider filtering", async () => {
    const profile = providerProfile({ filter: "^exit$" });
    await expect(new ChainBuilder({ profile }, chain).build()).rejects.toThrow();
  });

  test("rejects an unknown target in a fetched proxy", async () => {
    const profile = providerProfile();
    const nodes = [{ name: "exit", type: "direct", "dialer-proxy": "missing" }];
    await expect(new ChainBuilder({ profile }, nodes).build()).rejects.toThrow();
  });

  test("validates final dialer references in static native proxies", () => {
    const profile = PROFILE_SCHEMA.parse({
      proxies: [{ name: "exit", type: "direct", "dialer-proxy": "missing" }],
    });
    expect(() => compileProfile(profile, new Map(), [])).toThrow();
  });

  test("preserves a valid dialer reference to a group of static proxies", async () => {
    const profile = PROFILE_SCHEMA.parse({
      ...providerProfile({ override: { "additional-prefix": "Demo " } }),
      proxies: [{ name: "gateway", type: "direct" }],
      "proxy-groups": [
        { name: "Upstream", type: "select", proxies: ["gateway"] },
        { name: "Route", type: "select", use: ["Demo"] },
      ],
    });
    const nodes = [{ name: "exit", type: "direct", "dialer-proxy": "Upstream" }];
    const artifact = await new ChainBuilder({ profile }, nodes).build();
    const config = YAML.parse(artifact.body) as { proxies: StashProxy[] };
    expect(config.proxies.find(({ name }) => name === "Demo exit")).toMatchObject({
      "dialer-proxy": "Upstream",
    });
  });

  test("rejects a dialer-to-group cycle", async () => {
    const profile = providerProfile();
    const nodes = [{ name: "exit", type: "direct", "dialer-proxy": "Route" }];
    await expect(new ChainBuilder({ profile }, nodes).build()).rejects.toThrow();
  });
});
