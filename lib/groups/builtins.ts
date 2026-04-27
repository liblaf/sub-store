import type { ProxyWrapper } from "@/lib/core/proxy";

import type { GroupFactory, Group } from "./types";

export const BUILTIN_GROUPS: Record<string, GroupFactory> = {
  auto<T>(proxies: ProxyWrapper<T>[]): Group<T> {
    return {
      name: "Auto",
      type: "url-test",
      proxies: proxies.filter((proxy: ProxyWrapper<T>): boolean => !proxy.info),
      url: "https://cp.cloudflare.com",
      "expected-status": 204,
      icon: "TODO",
    };
  },

  info<T>(proxies: ProxyWrapper<T>[]): Group<T> {
    return {
      name: "Info",
      type: "select",
      proxies: proxies.filter((proxy: ProxyWrapper<T>): boolean => proxy.info),
      url: "https://cp.cloudflare.com",
      "expected-status": 204,
      icon: "TODO",
    };
  },

  ai<T>(proxies: ProxyWrapper<T>[]): Group<T> {
    const AI_EXCLUDE_COUNTRIES = new Set(["CN", "RU"]);
    return {
      name: "AI",
      type: "url-test",
      proxies: proxies.filter(
        (proxy: ProxyWrapper<T>): boolean =>
          !proxy.info && !(proxy.country.cca2 in AI_EXCLUDE_COUNTRIES),
      ),
      url: "https://chatgpt.com/favicon.ico",
      "expected-status": 200,
      icon: "TODO",
    };
  },

  crypto<T>(proxies: ProxyWrapper<T>[]): Group<T> {
    const CRYPTO_EXCLUDE_COUNTRIES = new Set(["CN", "RU"]);
    return {
      name: "Crypto",
      type: "url-test",
      proxies: proxies.filter(
        (proxy: ProxyWrapper<T>): boolean =>
          !proxy.info && !(proxy.country.cca2 in CRYPTO_EXCLUDE_COUNTRIES),
      ),
      url: "https://api.binance.com/api/v3/ping",
      "expected-status": 200,
      icon: "TODO",
    };
  },
};
