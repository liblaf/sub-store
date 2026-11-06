import { describe, expect, test } from "bun:test";

import type { ProviderOptions } from "../core/provider";
import { createProxyWrapper } from "../core/proxy";
import type { NativeProxy } from "../core/template";
import { prepareProviderProxies } from "./provider";

const base: ProviderOptions = { url: "https://example.invalid/subscription" };
const wrap = (proxy: NativeProxy) => createProxyWrapper({ name: proxy.name, wrapped: proxy });

describe("prepareProviderProxies", () => {
  test("applies true and false overrides while retaining native protocol settings", () => {
    const upstream = {
      name: "TLS Proxy",
      type: "trojan",
      tls: true,
      server: "example.invalid",
      port: 443,
      sni: "tls.example.invalid",
      "skip-cert-verify": true,
      fingerprint: "certificate-fingerprint",
      "client-fingerprint": "chrome",
      alpn: ["h2"],
      "ca-str": "certificate-authority",
    };
    for (const skipCertVerify of [false, true]) {
      const result = prepareProviderProxies([wrap(upstream)], {
        ...base,
        override: { "skip-cert-verify": skipCertVerify },
      });
      expect(result[0]!.wrapped).toEqual({ ...upstream, "skip-cert-verify": skipCertVerify });
    }
  });

  test("preserves upstream verification choices when the override is omitted", () => {
    const upstream: NativeProxy[] = [
      { name: "Enabled", type: "trojan", "skip-cert-verify": false },
      { name: "Skipped", type: "vmess", "skip-cert-verify": true },
      { name: "Default", type: "ss" },
    ];
    expect(prepareProviderProxies(upstream.map(wrap), base).map(({ wrapped }) => wrapped)).toEqual(
      upstream,
    );
  });

  test("keeps shared fetched records unchanged across provider and profile overrides", () => {
    const proxies = [
      wrap({ name: "Relay", type: "trojan", "skip-cert-verify": true }),
      wrap({ name: "Exit", type: "trojan", "dialer-proxy": "Relay" }),
    ];
    const original = structuredClone(proxies);
    for (const proxy of proxies) {
      Object.freeze(proxy.wrapped);
      Object.freeze(proxy);
    }
    const first = prepareProviderProxies(proxies, {
      ...base,
      override: { "additional-prefix": "First ", "skip-cert-verify": false },
    });
    const second = prepareProviderProxies(proxies, {
      ...base,
      override: { "additional-prefix": "Second ", "skip-cert-verify": true },
    });
    const unmodified = prepareProviderProxies(proxies, base);

    expect(first.map(({ name }) => name)).toEqual(["First Relay", "First Exit"]);
    expect(first[1]!.wrapped["dialer-proxy"]).toBe("First Relay");
    expect(first.every(({ wrapped }) => wrapped["skip-cert-verify"] === false)).toBe(true);
    expect(second.map(({ name }) => name)).toEqual(["Second Relay", "Second Exit"]);
    expect(second[1]!.wrapped["dialer-proxy"]).toBe("Second Relay");
    expect(second.every(({ wrapped }) => wrapped["skip-cert-verify"] === true)).toBe(true);
    expect(unmodified).toEqual(original);
    expect(proxies).toEqual(original);
    expect(first[0]).not.toBe(proxies[0]);
    expect(first[0]!.wrapped).not.toBe(proxies[0]!.wrapped);
  });

  test("strips and renames the complete provider before dialer rewriting and filtering", () => {
    const result = prepareProviderProxies(
      [
        wrap({ name: "pre alpha1 end", type: "trojan" }),
        wrap({ name: "pre beta2 end", type: "trojan", "dialer-proxy": "pre alpha1 end" }),
        wrap({ name: "pre Dropped end", type: "trojan" }),
        wrap({ name: "pre Excluded end", type: "ss" }),
      ],
      {
        ...base,
        "__sub-store": { "strip-common-affixes": true },
        override: {
          "proxy-name": [
            { pattern: "^alpha(?<number>1)$", target: "Relay$<number>" },
            { pattern: "^Relay1$", target: "Gateway" },
            { pattern: "^beta2$", target: "Exit" },
          ],
          "additional-prefix": "[Demo] ",
          "additional-suffix": "!",
        },
        filter: "(?i)^\\[demo\\] .*\\!$",
        "exclude-filter": "(?i)dropped",
        "exclude-type": "Ss|VMESS",
      },
    );
    expect(result.map(({ name, pretty }) => [name, pretty])).toEqual([
      ["[Demo] Gateway!", "[Demo] Gateway!"],
      ["[Demo] Exit!", "[Demo] Exit!"],
    ]);
    expect(result[1]!.wrapped["dialer-proxy"]).toBe("[Demo] Gateway!");
  });

  test("rewrites only provider-local dialers and keeps references to filtered proxies visible", () => {
    const result = prepareProviderProxies(
      [
        wrap({ name: "Relay", type: "direct" }),
        wrap({ name: "Exit", type: "trojan", "dialer-proxy": "Relay" }),
        wrap({ name: "External", type: "trojan", "dialer-proxy": "Static Group" }),
      ],
      { ...base, override: { "additional-prefix": "Demo " }, "exclude-filter": "Relay$" },
    );
    expect(result.map(({ name }) => name)).toEqual(["Demo Exit", "Demo External"]);
    expect(result[0]!.wrapped["dialer-proxy"]).toBe("Demo Relay");
    expect(result[1]!.wrapped["dialer-proxy"]).toBe("Static Group");
  });
});
