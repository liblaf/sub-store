import { expect, test } from "bun:test";

import { which } from "bun";
import YAML from "yaml";

import { PROFILE_SCHEMA } from "@/lib/core/profile";
import { renderProfile } from "@/lib/core/template";

import { MIHOMO_CONFIG_SCHEMA } from "./mihomo/schema";
import { STASH_CONFIG_SCHEMA } from "./stash/schema";
import { validateWithMihomo } from "./validate";

function renderGroups(target: "mihomo" | "stash"): string {
  const healthCheck = {
    [target === "mihomo" ? "url" : "benchmark-url"]: "https://cp.cloudflare.com/generate_204",
    interval: 300,
    lazy: false,
  };
  const profile = PROFILE_SCHEMA.parse({
    "__sub-store": { target },
    mode: "rule",
    dns: { enable: false },
    proxies: [{ name: "Local", type: "direct" }],
    "proxy-groups": [
      { name: "Failover", type: "fallback", proxies: ["Local", "DIRECT"], ...healthCheck },
      {
        name: "Balanced",
        type: "load-balance",
        proxies: ["Local", "DIRECT"],
        strategy: "consistent-hashing",
        ...healthCheck,
      },
      { name: "PROXY", type: "select", use: ["Failover", "Balanced"] },
    ],
    rules: ["MATCH,PROXY"],
  });
  return renderProfile({
    profile,
    providers: new Map(),
    infoProxies: [],
    schema: target === "mihomo" ? MIHOMO_CONFIG_SCHEMA : STASH_CONFIG_SCHEMA,
  });
}

for (const target of ["mihomo", "stash"] as const) {
  test(`${target} renders native fallback and load-balance policies with their settings`, () => {
    const config = YAML.parse(renderGroups(target));
    const healthCheck = {
      [target === "mihomo" ? "url" : "benchmark-url"]: "https://cp.cloudflare.com/generate_204",
      interval: 300,
      lazy: false,
    };
    expect(config["proxy-groups"]).toEqual([
      { name: "Failover", type: "fallback", proxies: ["Local", "DIRECT"], ...healthCheck },
      {
        name: "Balanced",
        type: "load-balance",
        proxies: ["Local", "DIRECT"],
        strategy: "consistent-hashing",
        ...healthCheck,
      },
      { name: "PROXY", type: "select", proxies: ["Failover", "Balanced"] },
    ]);
    expect(config.rules).toEqual(["MATCH,PROXY"]);
    expect(config).not.toHaveProperty("__sub-store");
  });
}

test.skipIf(!which("mihomo"))(
  "native Mihomo accepts compiled fallback and load-balance groups",
  async () => {
    await validateWithMihomo(renderGroups("mihomo"));
  },
);
