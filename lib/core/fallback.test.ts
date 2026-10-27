import { expect, test } from "bun:test";

import { PROFILE_SCHEMA } from "./profile";
import { compileProfile } from "./template";

const empty = { name: "Empty", type: "select", proxies: [] };

test("keeps an empty routing group with its explicit native reject fallback", () => {
  const profile = PROFILE_SCHEMA.parse({
    "__sub-store": { target: "mihomo" },
    __anchors: { private: true },
    "proxy-groups": [{ ...empty, "empty-fallback": "REJECT", interval: 300 }],
    rules: ["MATCH,Empty"],
  });
  const config = compileProfile(profile, new Map(), []);
  expect(config["proxy-groups"]).toEqual([
    {
      name: "Empty",
      type: "select",
      proxies: ["REJECT"],
      "empty-fallback": "REJECT",
      interval: 300,
    },
  ]);
  expect(config.rules).toEqual(["MATCH,Empty"]);
  expect(config).not.toHaveProperty("__sub-store");
  expect(config).not.toHaveProperty("__anchors");
});

test("uses the parent's explicit fallback when its empty child is removed", () => {
  const config = compileProfile(
    PROFILE_SCHEMA.parse({
      "proxy-groups": [
        { name: "PROXY", type: "select", proxies: ["Empty"], "empty-fallback": "REJECT" },
        empty,
      ],
      rules: ["MATCH,PROXY"],
    }),
    new Map(),
    [],
  );
  expect(config["proxy-groups"]).toEqual([
    { name: "PROXY", type: "select", proxies: ["REJECT"], "empty-fallback": "REJECT" },
  ]);
});

test("rejects missing and group-valued fallback targets", () => {
  for (const fallback of ["Missing", "Other", "GLOBAL"]) {
    expect(() =>
      compileProfile(
        PROFILE_SCHEMA.parse({
          "proxy-groups": [
            { ...empty, "empty-fallback": fallback },
            { name: "Other", type: "select", proxies: ["DIRECT"] },
          ],
          rules: ["MATCH,Empty"],
        }),
        new Map(),
        [],
      ),
    ).toThrow("invalid empty-fallback");
  }
});

test("rejects a fallback that creates a proxy-to-group cycle after pruning", () => {
  expect(() =>
    compileProfile(
      PROFILE_SCHEMA.parse({
        proxies: [{ name: "Relay", type: "direct", "dialer-proxy": "PROXY" }],
        "proxy-groups": [
          { name: "PROXY", type: "select", proxies: ["Empty"], "empty-fallback": "Relay" },
          empty,
        ],
        rules: ["MATCH,PROXY"],
      }),
      new Map(),
      [],
    ),
  ).toThrow("Circular");
});
