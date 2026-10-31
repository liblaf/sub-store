import { expect, test } from "bun:test";

import { which } from "bun";
import YAML from "yaml";

import { PROFILE_SCHEMA } from "@/lib/core/profile";
import { renderProfile } from "@/lib/core/template";

import { validateWithMihomo } from "../validate";
import { MIHOMO_CONFIG_SCHEMA, MIHOMO_SMART_CONFIG_SCHEMA } from "./schema";

function renderSmartProfile(): string {
  const profile = PROFILE_SCHEMA.parse(
    YAML.parse(
      `
__sub-store:
  target: mihomo-smart
mode: rule
dns:
  enable: false
lgbm-auto-update: false
lgbm-update-interval: 72
lgbm-url: https://example.invalid/model.bin
__smart: &smart
  type: smart
  url: https://example.invalid/generate_204
  interval: 300
  uselightgbm: false
  prefer-asn: true
  collectdata: true
  empty-fallback: REJECT
  __private: removed
proxy-providers:
  Example:
    url: https://example.invalid/subscription
proxy-groups:
  - <<: *smart
    name: Auto
    include-all-providers: true
    filter: US
  - <<: *smart
    name: Empty
    use: [Example]
    filter: Missing
  - name: PROXY
    type: select
    use: [Auto, Empty]
rules:
  - MATCH,PROXY
`,
      { merge: true },
    ),
  );
  return renderProfile({
    profile,
    providers: new Map([
      [
        "Example",
        [
          { name: "US Node", type: "direct" },
          { name: "HK Node", type: "direct" },
        ],
      ],
    ]),
    infoProxies: [{ name: "Provider Info", type: "direct" }],
    schema: MIHOMO_SMART_CONFIG_SCHEMA,
  });
}

test("Smart profiles expand providers and preserve native Smart settings and YAML merges", () => {
  const config = YAML.parse(renderSmartProfile());
  const smart = {
    type: "smart",
    url: "https://example.invalid/generate_204",
    interval: 300,
    uselightgbm: false,
    "prefer-asn": true,
    collectdata: true,
    "empty-fallback": "REJECT",
  };
  expect(config["proxy-groups"]).toEqual([
    { ...smart, name: "Auto", proxies: ["US Node"] },
    { ...smart, name: "Empty", proxies: ["REJECT"] },
    { name: "PROXY", type: "select", proxies: ["Auto", "Empty"] },
  ]);
  expect(config["lgbm-auto-update"]).toBe(false);
  expect(config["lgbm-update-interval"]).toBe(72);
  expect(config["lgbm-url"]).toBe("https://example.invalid/model.bin");
  expect(config).not.toHaveProperty("proxy-providers");
  expect(config).not.toHaveProperty("__sub-store");
  expect(config).not.toHaveProperty("__smart");
  expect(config.rules).toEqual(["MATCH,PROXY"]);
  expect(MIHOMO_CONFIG_SCHEMA.safeParse(config).success).toBe(false);
});

test.skipIf(!which("mihomo-smart"))(
  "the Smart core accepts an offline compiled Smart group",
  async () => {
    const body = renderProfile({
      profile: PROFILE_SCHEMA.parse({
        "__sub-store": { target: "mihomo-smart" },
        dns: { enable: false },
        "proxy-groups": [{ name: "Smart", type: "smart", proxies: ["DIRECT"], uselightgbm: false }],
        rules: ["MATCH,Smart"],
      }),
      providers: new Map(),
      infoProxies: [],
      schema: MIHOMO_SMART_CONFIG_SCHEMA,
    });
    await validateWithMihomo(body, "mihomo-smart");
  },
);
