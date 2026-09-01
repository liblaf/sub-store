import { describe, expect, test } from "bun:test";

import { createProxyWrapper } from "@/lib/core/proxy";
import type { ProxyWrapper } from "@/lib/core/proxy";
import { COUNTRY_UNKNOWN, CCA2_TO_COUNTRY } from "@/lib/pipeline/infer/country";

import { BUILTIN_GROUPS } from "./builtins";

type Proxy = { name: string; type: "direct" };

function proxy(name: string, cca2: string, info = false): ProxyWrapper<Proxy> {
  return createProxyWrapper({
    name,
    wrapped: { name, type: "direct" },
    country: CCA2_TO_COUNTRY[cca2] ?? COUNTRY_UNKNOWN,
    info,
  });
}

describe("built-in groups", (): void => {
  test("separates Unknown provider nodes from custom Info nodes", (): void => {
    const germany = proxy("Germany", "DE");
    const france = proxy("France", "FR");
    const providerInfo = proxy("Provider Traffic", "UN");
    const customInfo = proxy("Custom Info", "UN", true);
    const proxies = [germany, france, providerInfo, customInfo];

    expect(BUILTIN_GROUPS.auto!(proxies).proxies).toEqual([germany, france]);
    expect(BUILTIN_GROUPS.info!(proxies)).toMatchObject({
      proxies: [customInfo],
      icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/Info.png",
    });
    expect(BUILTIN_GROUPS.crypto!(proxies).proxies).toEqual([germany]);
  });
});
