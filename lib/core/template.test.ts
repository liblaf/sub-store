import { describe, expect, test } from "bun:test";

import YAML from "yaml";

import { MIHOMO_CONFIG_SCHEMA } from "@/lib/formats/mihomo/schema";
import { STASH_CONFIG_SCHEMA } from "@/lib/formats/stash/schema";

import { PROFILE_SCHEMA } from "./profile";
import { compileProfile, renderProfile } from "./template";

const node = (name: string) => ({ name, type: "direct" });
const providers = new Map([
  ["Beta", [node("[Beta] United States 2"), node("[Beta] Germany")]],
  ["Alpha", [node("[Alpha] United States 1"), node("[Alpha] Traffic: 50 GB")]],
]);
const info = [node("[Alpha] 📊 50 B / 100 B (50%)"), node("[Beta] 📥 2026-10-27")];

function profile(extra: Record<string, unknown> = {}) {
  return PROFILE_SCHEMA.parse({
    "mixed-port": 7890,
    dns: { enable: true, nameserver: ["https://dns.example/dns-query"] },
    proxies: [node("Static")],
    "proxy-providers": {
      Alpha: { url: "https://example.invalid/alpha" },
      Beta: { url: "https://example.invalid/beta" },
    },
    "proxy-groups": [
      { name: "PROXY", type: "select", proxies: ["Static"], use: ["Auto", "United States"] },
      {
        name: "Auto",
        type: "url-test",
        "include-all-providers": true,
        "exclude-filter": "Traffic|剩余流量",
        url: "https://example.invalid/check",
        interval: 300,
      },
      { name: "United States", type: "select", use: ["Alpha", "Beta"], filter: "United States" },
      { name: "Info", type: "select", use: ["$info"] },
    ],
    rules: ["MATCH,PROXY"],
    ...extra,
  });
}

function groups(config: Record<string, unknown>) {
  return Object.fromEntries(
    (config["proxy-groups"] as { name: string; proxies: string[] }[]).map((group) => [
      group.name,
      group.proxies,
    ]),
  );
}

describe("native profile compiler", () => {
  test("preserves native settings and static proxies while expanding providers and group references", () => {
    const input = profile({ "__sub-store": { target: "stash", id: "0123456789ABCDEFGHJK" } });
    const before = structuredClone(input);
    const config = compileProfile(input, providers, info);

    expect(config["mixed-port"]).toBe(7890);
    expect(config.dns).toEqual(input.dns);
    expect(config.proxies).toEqual([
      node("Static"),
      ...providers.get("Alpha")!,
      ...providers.get("Beta")!,
      ...info,
    ]);
    expect(groups(config)).toEqual({
      PROXY: ["Static", "Auto", "United States"],
      Auto: ["[Alpha] United States 1", "[Beta] United States 2", "[Beta] Germany"],
      "United States": ["[Alpha] United States 1", "[Beta] United States 2"],
      Info: info.map(({ name }) => name),
    });
    expect(config.rules).toEqual(["MATCH,PROXY"]);
    expect(config).not.toHaveProperty("proxy-providers");
    expect(config).not.toHaveProperty("__sub-store");
    for (const group of config["proxy-groups"] as Record<string, unknown>[]) {
      for (const key of ["use", "include-all-providers", "filter", "exclude-filter"]) {
        expect(group).not.toHaveProperty(key);
      }
    }
    expect(input).toEqual(before);
  });

  test("deduplicates members in explicit, use, then include-all provider order", () => {
    const config = compileProfile(
      profile({
        "proxy-groups": [
          {
            name: "PROXY",
            type: "select",
            proxies: ["Static", "[Beta] Germany"],
            use: ["Beta", "Alpha", "Beta"],
            "include-all-providers": true,
          },
        ],
      }),
      providers,
      info,
    );
    expect(groups(config).PROXY).toEqual([
      "Static",
      "[Beta] Germany",
      "[Beta] United States 2",
      "[Alpha] United States 1",
      "[Alpha] Traffic: 50 GB",
    ]);
  });

  test("filters imported names without filtering explicit members or group references", () => {
    const config = compileProfile(
      profile({
        "proxy-groups": [
          {
            name: "PROXY",
            type: "select",
            proxies: ["Static"],
            use: ["United States", "Alpha", "Beta"],
            filter: "United States|Traffic",
            "exclude-filter": "Traffic|States 2",
          },
          { name: "United States", type: "select", proxies: ["Static"] },
        ],
      }),
      providers,
      [],
    );
    expect(groups(config).PROXY).toEqual(["Static", "United States", "[Alpha] United States 1"]);
  });

  test("removes unused empty groups and retains rules verbatim", () => {
    const config = compileProfile(
      profile({
        "proxy-groups": [
          { name: "PROXY", type: "select", proxies: ["Static"] },
          { name: "Unused", type: "select", use: ["Alpha"], filter: "no such node" },
        ],
      }),
      providers,
      [],
    );
    expect(groups(config)).toEqual({ PROXY: ["Static"] });
    expect(config.rules).toEqual(["MATCH,PROXY"]);
  });

  test.each([
    "MATCH,Empty",
    "RULE-SET,example,Empty,no-resolve",
    "DOMAIN-SUFFIX,example.com,Empty,no-track",
    "NOT,((DOMAIN-SUFFIX,example.com)),Empty,no-track",
  ])("rejects an empty routing group targeted by %s", (rule) => {
    expect(() =>
      compileProfile(
        profile({
          "proxy-groups": [
            { name: "Empty", type: "select", use: ["Alpha"], filter: "no such node" },
          ],
          "rule-providers": {
            example: { type: "http", behavior: "domain", url: "https://example.invalid/rules" },
          },
          rules: [rule],
        }),
        providers,
        [],
      ),
    ).toThrow();
  });

  test("rejects unknown use sources and ambiguous provider/group names", () => {
    expect(() =>
      compileProfile(
        profile({ "proxy-groups": [{ name: "PROXY", type: "select", use: ["Missing"] }] }),
        providers,
        [],
      ),
    ).toThrow();
    expect(() =>
      compileProfile(
        profile({ "proxy-groups": [{ name: "Alpha", type: "select", proxies: ["Static"] }] }),
        providers,
        [],
      ),
    ).toThrow();
  });

  test("rejects duplicate proxies across static, provider, and generated sources", () => {
    expect(() =>
      compileProfile(profile({ proxies: [node("[Alpha] United States 1")] }), providers, []),
    ).toThrow();
    expect(() =>
      compileProfile(
        profile(),
        new Map([
          ["Alpha", [node("Repeated")]],
          ["Beta", [node("Repeated")]],
        ]),
        [],
      ),
    ).toThrow();
    expect(() => compileProfile(profile(), providers, [node("Static")])).toThrow();
  });

  test("rejects cycles through both native proxies and use references", () => {
    for (const key of ["proxies", "use"]) {
      expect(() =>
        compileProfile(
          profile({
            "proxy-groups": [
              { name: "PROXY", type: "select", [key]: ["Other"] },
              { name: "Other", type: "select", [key]: ["PROXY"] },
            ],
          }),
          providers,
          [],
        ),
      ).toThrow();
    }
  });

  test("rejects unresolved members, rule targets, and rule providers", () => {
    expect(() =>
      compileProfile(
        profile({ "proxy-groups": [{ name: "PROXY", type: "select", proxies: ["Missing"] }] }),
        providers,
        [],
      ),
    ).toThrow();
    expect(() => compileProfile(profile({ rules: ["MATCH,Missing"] }), providers, [])).toThrow();
    expect(() =>
      compileProfile(profile({ rules: ["RULE-SET,Missing,PROXY"] }), providers, []),
    ).toThrow();
  });

  test("renders native Mihomo and Stash configurations through their target schemas", async () => {
    for (const schema of [MIHOMO_CONFIG_SCHEMA, STASH_CONFIG_SCHEMA]) {
      const output = await renderProfile({
        profile: profile(),
        providers,
        infoProxies: info,
        schema,
      });
      const config = YAML.parse(output);
      expect(config.proxies).toHaveLength(7);
      expect(groups(config).PROXY).toEqual(["Static", "Auto", "United States"]);
    }
  });
});
