import type { ProxyWrapper } from "@/lib/core/proxy";

import type { GroupFactory, Group } from "./types";

function icon(name: string): string {
  return `https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/${name}.png`;
}

export const BUILTIN_GROUPS: Record<string, GroupFactory> = {
  auto<T>(proxies: ProxyWrapper<T>[]): Group<T> {
    return {
      name: "Auto",
      type: "url-test",
      proxies: proxies.filter((proxy: ProxyWrapper<T>): boolean => !proxy.info),
      url: "https://cp.cloudflare.com",
      "expected-status": 204,
      icon: icon("Auto"),
    };
  },

  info<T>(proxies: ProxyWrapper<T>[]): Group<T> {
    return {
      name: "Info",
      type: "select",
      proxies: proxies.filter((proxy: ProxyWrapper<T>): boolean => proxy.info),
      url: "https://cp.cloudflare.com",
      "expected-status": 204,
      icon: icon("Lab"),
    };
  },

  ai<T>(proxies: ProxyWrapper<T>[]): Group<T> {
    const AI_EXCLUDE_CCA2 = new Set(["CN", "HK"]);
    return {
      name: "AI",
      type: "url-test",
      proxies: proxies.filter(
        (proxy: ProxyWrapper<T>): boolean =>
          !proxy.info && !AI_EXCLUDE_CCA2.has(proxy.country.cca2),
      ),
      url: "https://chatgpt.com/favicon.ico",
      "expected-status": 200,
      icon: icon("AI"),
    };
  },

  crypto<T>(proxies: ProxyWrapper<T>[]): Group<T> {
    const CRYPTO_EXCLUDE_CCA2 = new Set(["CA", "CN", "HK", "JP", "MY", "NL", "US"]);
    return {
      name: "Crypto",
      type: "url-test",
      proxies: proxies.filter(
        (proxy: ProxyWrapper<T>): boolean =>
          !proxy.info && !CRYPTO_EXCLUDE_CCA2.has(proxy.country.cca2),
      ),
      url: "https://api.binance.com/api/v3/ping",
      "expected-status": 200,
      icon: icon("Cryptocurrency"),
    };
  },
};
