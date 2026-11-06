import { describe, expect, test } from "bun:test";

import { PROFILE_SCHEMA } from "./profile";
import { compileProfile } from "./template";
import type { NativeProxy } from "./template";

const info: NativeProxy[] = [{ name: "Generated Info", type: "direct", udp: true }];
const display = { name: "Info Group", type: "select", use: ["$info"] };
const nested = { name: "Nested", type: "select", proxies: ["Info Group"] };

function compile(extra: Record<string, unknown> = {}) {
  return compileProfile(
    PROFILE_SCHEMA.parse({ "proxy-groups": [display, nested], ...extra }),
    new Map(),
    info,
  );
}

describe("display-only Info Proxies", () => {
  test("retains standalone display groups and the generated native representation", () => {
    const config = compile({ rules: ["MATCH,DIRECT"] });
    expect(config.proxies).toEqual(info);
    expect(config["proxy-groups"]).toEqual([
      { name: "Info Group", type: "select", proxies: ["Generated Info"] },
      nested,
    ]);
  });

  test.each(["Generated Info", "Info Group", "Nested"])(
    "rejects a routing rule reaching %s",
    (target) => {
      expect(() => compile({ rules: [`MATCH,${target}`] })).toThrow("display-only Info Proxy");
    },
  );

  test("checks compound rules and trailing options without reporting the rule content", () => {
    expect(() =>
      compile({ rules: ["AND,((NETWORK,UDP),(DST-PORT,443)),Nested,no-track"] }),
    ).toThrow("Routing references a display-only Info Proxy");
  });

  test("checks the fallback applied after removing an empty child", () => {
    expect(() =>
      compile({
        "proxy-groups": [
          {
            name: "Route",
            type: "select",
            proxies: ["Empty"],
            "empty-fallback": "Generated Info",
          },
          { name: "Empty", type: "select" },
        ],
        rules: ["MATCH,Route"],
      }),
    ).toThrow("display-only Info Proxy");
  });

  test.each(["Generated Info", "Info Group", "Nested"])(
    "checks static and Provider Proxy dialers reaching %s",
    (target) => {
      const proxy = { name: "Relay", type: "trojan", "dialer-proxy": target };
      expect(() => compile({ proxies: [proxy] })).toThrow("display-only Info Proxy");
      expect(() =>
        compileProfile(
          PROFILE_SCHEMA.parse({
            "proxy-providers": { Demo: { url: "https://example.invalid/subscription" } },
            "proxy-groups": [display, nested],
          }),
          new Map([["Demo", [proxy]]]),
          info,
        ),
      ).toThrow("display-only Info Proxy");
    },
  );

  test.each(["Generated Info", "Nested"])("checks nested named sub-rules reaching %s", (target) => {
    expect(() =>
      compile({
        rules: ["SUB-RULE,(NETWORK,UDP),first"],
        "sub-rules": {
          first: ["SUB-RULE,(DST-PORT,53),second"],
          second: [`MATCH,${target}`],
        },
      }),
    ).toThrow("display-only Info Proxy");
  });

  test("checks listeners that select a proxy group or named sub-rule", () => {
    expect(() =>
      compile({ listeners: [{ name: "test", type: "mixed", proxy: "Nested" }] }),
    ).toThrow("display-only Info Proxy");
    expect(() =>
      compile({
        listeners: [{ name: "test", type: "mixed", rule: "listener-rules" }],
        "sub-rules": { "listener-rules": ["MATCH,Info Group"] },
      }),
    ).toThrow("display-only Info Proxy");
  });

  test.each([
    "default-nameserver",
    "nameserver",
    "fallback",
    "proxy-server-nameserver",
    "direct-nameserver",
    "nameserver-policy",
    "proxy-server-nameserver-policy",
  ])("checks explicit DNS resolver selections in %s", (key) => {
    for (const target of ["Generated Info", "Nested"]) {
      const server = `https://dns.example.invalid/dns-query#${encodeURIComponent(target)}&h3=true`;
      const servers = key.endsWith("-policy") ? { "example.invalid": server } : [server];
      expect(() => compile({ dns: { [key]: servers } })).toThrow("display-only Info Proxy");
    }
  });

  test("keeps safe routes and Provider Proxies whose labels contain Info", () => {
    const providerProxies = [{ name: "Provider Info: 50 GB", type: "direct" }];
    const profile = PROFILE_SCHEMA.parse({
      "proxy-providers": { Demo: { url: "https://example.invalid/subscription" } },
      "proxy-groups": [display, { name: "Route", type: "select", use: ["Demo"] }],
      rules: ["SUB-RULE,(NETWORK,TCP),safe", "MATCH,Route"],
      "sub-rules": {
        safe: ["MATCH,Route"],
        unused: ["MATCH,Generated Info"],
      },
      listeners: [{ name: "test", type: "mixed", proxy: "Route", rule: "unused" }],
      dns: {
        nameserver: [
          "https://dns.example.invalid/dns-query#Route&h3=true",
          "https://dns.example.invalid/dns-query#Info%20Group&eth0",
          "https://dns.example.invalid/dns-query#eth0&ecs=Info%20Group",
        ],
        "nameserver-policy": { "example.invalid": ["https://dns.example.invalid#DIRECT"] },
        "fallback-filter": { domain: ["example.invalid#Info Group"] },
      },
    });
    const config = compileProfile(profile, new Map([["Demo", providerProxies]]), info);
    expect(config.proxies).toEqual([...providerProxies, ...info]);
    expect(config.rules).toEqual(profile.rules);
    expect(config.dns).toEqual(profile.dns);
  });
});
