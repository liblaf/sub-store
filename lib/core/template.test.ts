import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

import { createProxyWrapper } from "@/lib/core/proxy";
import type { ProxyWrapper } from "@/lib/core/proxy";
import { MIHOMO_CONFIG_SCHEMA } from "@/lib/formats/mihomo/schema";
import type { MihomoProxy } from "@/lib/formats/mihomo/schema";
import { STASH_CONFIG_SCHEMA } from "@/lib/formats/stash/schema";
import { CRYPTO_COUNTRY_CCA2 } from "@/lib/groups/builtins";
import { iconFromCountry } from "@/lib/groups/country";
import { COUNTRY_UNKNOWN, CCA2_TO_COUNTRY } from "@/lib/pipeline/infer/country";
import MIHOMO_TEMPLATE from "@/templates/mihomo.yaml";
import STASH_TEMPLATE from "@/templates/stash.yaml";

import { createTemplateContext, renderTemplate } from "./template";

const usProxyOne: ProxyWrapper<MihomoProxy> = proxy("US raw one", "US One", "US");
const germanyProxy: ProxyWrapper<MihomoProxy> = proxy("DE raw", "Germany One", "DE");
const usProxyTwo: ProxyWrapper<MihomoProxy> = proxy("US raw two", "US Two", "US");
const unknownProxy: ProxyWrapper<MihomoProxy> = proxy("Unknown raw", "Unknown One", "UN");
const providerInfoProxy: ProxyWrapper<MihomoProxy> = proxy(
  "Traffic: 50 GB / 100 GB",
  "Provider Traffic",
  "UN",
);
const generatedInfoNames = [
  "Header 🔋 50.0 B / 100 B (50%)",
  "Header ⏳ 2027-01-01",
  "Header 🔄 2026-08-30",
  "Partial 🔄 2026-08-31",
  "Counter 🔋 100 B / 200 B (50%)",
  "Counter 🔄 2026-09-01 · resets day 15",
];

const proxies: ProxyWrapper<MihomoProxy>[] = [
  usProxyOne,
  germanyProxy,
  usProxyTwo,
  unknownProxy,
  providerInfoProxy,
];
const infoProxies: ProxyWrapper<MihomoProxy>[] = generatedInfoNames.map(
  (name: string): ProxyWrapper<MihomoProxy> => proxy(name, name, "UN", true),
);

const countryGroupOptions = {
  type: "url-test",
  url: "https://cp.cloudflare.com",
  interval: 300,
  lazy: true,
  timeout: 1200,
  "max-failed-times": 1,
  "expected-status": 204,
} as const;

describe("JSON-e templates", (): void => {
  test("builds a versioned data-only context", (): void => {
    const context = createTemplateContext("mihomo", proxies, infoProxies);

    expect(context.version).toBe(6);
    expect(context.target).toBe("mihomo");
    expect(context.proxies.map(({ name, country }) => ({ name, country: country.cca2 }))).toEqual([
      { name: "US One", country: "US" },
      { name: "Germany One", country: "DE" },
      { name: "US Two", country: "US" },
      { name: "Unknown One", country: "UN" },
      { name: "Provider Traffic", country: "UN" },
    ]);
    expect(context.infoProxies.map(({ name }) => name)).toEqual(generatedInfoNames);
    expect(context.proxies[0]!.mihomo).toEqual({ name: "US One", type: "direct" });
    expect(context.proxies[0]!.stash).toBeUndefined();
    expect(context.infoProxies[0]!.mihomo).toEqual({
      name: generatedInfoNames[0]!,
      type: "direct",
      udp: true,
    });
    expect(context.infoProxies[0]).not.toHaveProperty("country");
    expect(context.infoProxies[0]).not.toHaveProperty("info");
    expect(context).not.toHaveProperty("providers");
    expect(
      context.countries.map(({ cca2, name, icon, proxies }) => ({
        cca2,
        name,
        icon,
        proxies: proxies.map((proxy) => proxy.name),
      })),
    ).toEqual([
      {
        cca2: "US",
        name: "United States",
        icon: iconFromCountry(CCA2_TO_COUNTRY.US!),
        proxies: ["US One", "US Two"],
      },
      {
        cca2: "DE",
        name: "Germany",
        icon: iconFromCountry(CCA2_TO_COUNTRY.DE!),
        proxies: ["Germany One"],
      },
    ]);
    expect(context.countries[0]!.proxies[0]).toEqual(context.proxies[0]);
    expect(context.CRYPTO_COUNTRIES).toEqual([...CRYPTO_COUNTRY_CCA2]);
    expect(JSON.parse(JSON.stringify(context))).toEqual(context);
  });

  test("renders the Mihomo template with proxy-record country members", async (): Promise<void> => {
    const output: string = await renderTemplate({
      builtin: { url: "builtin://mihomo.yaml", value: MIHOMO_TEMPLATE },
      context: createTemplateContext("mihomo", proxies, infoProxies),
      schema: MIHOMO_CONFIG_SCHEMA,
      template: "builtin://mihomo.yaml",
    });
    const config = MIHOMO_CONFIG_SCHEMA.parse(YAML.parse(output));
    const proxyNames = config.proxies.map(({ name }) => name);
    const renderedGroups = Object.fromEntries(
      config["proxy-groups"].map(({ name, proxies }) => [name, proxies]),
    );

    expect(proxyNames).toEqual([
      "US One",
      "Germany One",
      "US Two",
      "Unknown One",
      "Provider Traffic",
      "TAILSCALE",
      ...generatedInfoNames,
    ]);
    expect(renderedGroups).toMatchObject({
      PROXY: ["Auto", "United States", "Germany"],
      Auto: ["US One", "Germany One", "US Two"],
      Info: [
        "Header 🔋 50.0 B / 100 B (50%)",
        "Header ⏳ 2027-01-01",
        "Header 🔄 2026-08-30",
        "Partial 🔄 2026-08-31",
        "Counter 🔋 100 B / 200 B (50%)",
        "Counter 🔄 2026-09-01 · resets day 15",
      ],
      Crypto: ["Germany One"],
      Unknown: ["Unknown One", "Provider Traffic"],
      "United States": ["US One", "US Two"],
      Germany: ["Germany One"],
    });
    expect(config["proxy-groups"].find(({ name }) => name === "Germany")).toMatchObject({
      proxies: ["Germany One"],
      icon: iconFromCountry(CCA2_TO_COUNTRY.DE!),
      ...countryGroupOptions,
    });
    for (const name of generatedInfoNames) {
      expect(config.proxies.find((proxy) => proxy.name === name)).toMatchObject({
        name,
        type: "direct",
        udp: true,
      });
    }
    expect(config.rules).toContain("RULE-SET,domain-global,PROXY");
    expect((config["rule-providers"] as Record<string, unknown>)["domain-cn"]).toMatchObject({
      type: "http",
      behavior: "domain",
      format: "mrs",
    });
    expect(config).not.toHaveProperty("__proxy-group-anchors");
    expect(config).not.toHaveProperty("__rule-providers-anchors");
  });

  test("renders anchored Mihomo templates identically from built-in and file sources", async (): Promise<void> => {
    const options = {
      builtin: { url: "builtin://mihomo.yaml", value: MIHOMO_TEMPLATE },
      context: createTemplateContext("mihomo", proxies, infoProxies),
      schema: MIHOMO_CONFIG_SCHEMA,
    };
    const builtinOutput: string = await renderTemplate({
      ...options,
      template: options.builtin.url,
    });
    const fileOutput: string = await renderTemplate({
      ...options,
      template: fileURLToPath(new URL("../../templates/mihomo.yaml", import.meta.url)),
    });

    expect(YAML.parse(fileOutput)).toEqual(YAML.parse(builtinOutput));
  });

  test("recursively removes empty groups and rules that target them", async (): Promise<void> => {
    const output: string = await renderTemplate({
      builtin: { url: "builtin://mihomo.yaml", value: MIHOMO_TEMPLATE },
      context: createTemplateContext("mihomo", [usProxyOne], []),
      schema: MIHOMO_CONFIG_SCHEMA,
      template: "builtin://mihomo.yaml",
    });
    const config = MIHOMO_CONFIG_SCHEMA.parse(YAML.parse(output));

    expect(config["proxy-groups"].map(({ name }) => name)).toEqual([
      "PROXY",
      "Auto",
      "United States",
    ]);
    expect(config.rules).not.toContain("RULE-SET,domain-crypto,Crypto");
  });

  test("uses an explicit Crypto country allowlist", async (): Promise<void> => {
    const franceProxy: ProxyWrapper<MihomoProxy> = proxy("FR raw", "France One", "FR");
    const output: string = await renderTemplate({
      builtin: { url: "builtin://mihomo.yaml", value: MIHOMO_TEMPLATE },
      context: createTemplateContext("mihomo", [usProxyOne, franceProxy], []),
      schema: MIHOMO_CONFIG_SCHEMA,
      template: "builtin://mihomo.yaml",
    });
    const config = MIHOMO_CONFIG_SCHEMA.parse(YAML.parse(output));

    expect(config["proxy-groups"].map(({ name }) => name)).toEqual([
      "PROXY",
      "Auto",
      "United States",
      "France",
    ]);
    expect(config.rules).not.toContain("RULE-SET,domain-crypto,Crypto");
  });

  test("renders the Stash template from the same semantic context", async (): Promise<void> => {
    const output: string = await renderTemplate({
      builtin: { url: "builtin://stash.yaml", value: STASH_TEMPLATE },
      context: createTemplateContext("stash", proxies, infoProxies),
      schema: STASH_CONFIG_SCHEMA,
      template: "builtin://stash.yaml",
    });
    const config = STASH_CONFIG_SCHEMA.parse(YAML.parse(output));
    const renderedGroups = Object.fromEntries(
      config["proxy-groups"].map(({ name, proxies }) => [name, proxies]),
    );

    expect(config.proxies.map(({ name }) => name)).toEqual([
      "US One",
      "Germany One",
      "US Two",
      "Unknown One",
      "Provider Traffic",
      ...generatedInfoNames,
    ]);
    for (const name of generatedInfoNames) {
      expect(config.proxies.find((proxy) => proxy.name === name)).toMatchObject({
        name,
        type: "direct",
        udp: true,
      });
    }
    expect(renderedGroups).toMatchObject({
      PROXY: ["Auto", "United States", "Germany"],
      Auto: ["US One", "Germany One", "US Two"],
      Info: [
        "Header 🔋 50.0 B / 100 B (50%)",
        "Header ⏳ 2027-01-01",
        "Header 🔄 2026-08-30",
        "Partial 🔄 2026-08-31",
        "Counter 🔋 100 B / 200 B (50%)",
        "Counter 🔄 2026-09-01 · resets day 15",
      ],
      Crypto: ["Germany One"],
      Unknown: ["Unknown One", "Provider Traffic"],
      "United States": ["US One", "US Two"],
      Germany: ["Germany One"],
    });
    expect(config.rules).toContain("RULE-SET,domain-global,PROXY");
    expect((config["rule-providers"] as Record<string, unknown>)["domain-cn"]).toMatchObject({
      behavior: "domain",
      format: "mrs",
    });
    expect((config["rule-providers"] as Record<string, unknown>)["domain-cn"]).not.toHaveProperty(
      "type",
    );
    expect(config).not.toHaveProperty("__proxy-group-anchors");
    expect(config).not.toHaveProperty("__rule-providers-anchors");
  });

  test("rejects invalid configs, duplicate names, and unresolved references", async (): Promise<void> => {
    await expect(
      renderTemplate({
        builtin: {
          url: "builtin://invalid.yaml",
          value: { proxies: "invalid", "proxy-groups": [] },
        },
        context: {},
        schema: MIHOMO_CONFIG_SCHEMA,
        template: "builtin://invalid.yaml",
      }),
    ).rejects.toThrow();

    await expect(
      renderTemplate({
        builtin: {
          url: "builtin://duplicate.yaml",
          value: {
            proxies: [
              { name: "Node", type: "direct" },
              { name: "Node", type: "direct" },
            ],
            "proxy-groups": [],
          },
        },
        context: {},
        schema: MIHOMO_CONFIG_SCHEMA,
        template: "builtin://duplicate.yaml",
      }),
    ).rejects.toThrow("Duplicate proxy or group name: Node");

    await expect(
      renderTemplate({
        builtin: {
          url: "builtin://missing-member.yaml",
          value: {
            proxies: [{ name: "Node", type: "direct" }],
            "proxy-groups": [{ name: "PROXY", type: "select", proxies: ["Missing"] }],
          },
        },
        context: {},
        schema: MIHOMO_CONFIG_SCHEMA,
        template: "builtin://missing-member.yaml",
      }),
    ).rejects.toThrow("Proxy group PROXY references an unknown proxy or group: Missing");

    await expect(
      renderTemplate({
        builtin: {
          url: "builtin://missing-rule-target.yaml",
          value: {
            proxies: [{ name: "Node", type: "direct" }],
            "proxy-groups": [{ name: "PROXY", type: "select", proxies: ["Node"] }],
            "rule-providers": { "domain-crypto": {} },
            rules: ["RULE-SET,domain-crypto,Crypto", "MATCH,PROXY"],
          },
        },
        context: {},
        schema: MIHOMO_CONFIG_SCHEMA,
        template: "builtin://missing-rule-target.yaml",
      }),
    ).rejects.toThrow("Rule references an unknown proxy or group: Crypto");

    await expect(
      renderTemplate({
        builtin: {
          url: "builtin://missing-rule-provider.yaml",
          value: {
            proxies: [{ name: "Node", type: "direct" }],
            "proxy-groups": [{ name: "PROXY", type: "select", proxies: ["Node"] }],
            rules: ["RULE-SET,missing,PROXY"],
          },
        },
        context: {},
        schema: MIHOMO_CONFIG_SCHEMA,
        template: "builtin://missing-rule-provider.yaml",
      }),
    ).rejects.toThrow("Rule references an unknown rule provider: missing");
  });
});

function proxy(
  name: string,
  pretty: string,
  cca2: string,
  info = false,
): ProxyWrapper<MihomoProxy> {
  return createProxyWrapper({
    name,
    pretty,
    wrapped: { name, type: "direct", ...(info ? { udp: true } : {}) },
    country: CCA2_TO_COUNTRY[cca2] ?? COUNTRY_UNKNOWN,
    info,
  });
}
