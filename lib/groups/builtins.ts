import type { ProxyWrapper } from "@/lib/core/proxy";

import type { GroupFactory, Group } from "./types";

function icon(name: string): string {
  return `https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/${name}.png`;
}

export const CRYPTO_COUNTRY_CCA2 = [
  "AR",
  "AU",
  "BR",
  "CL",
  "DE",
  "ES",
  "GB",
  "IL",
  "IN",
  "IT",
  "KR",
  "SG",
  "TH",
  "TR",
  "TW",
  "VN",
  "ZA",
] as const;

const CRYPTO_COUNTRIES = new Set<string>(CRYPTO_COUNTRY_CCA2);

export const BUILTIN_GROUPS: Record<string, GroupFactory> = {
  auto<T>(proxies: ProxyWrapper<T>[]): Group<T> {
    return {
      name: "Auto",
      type: "url-test",
      proxies: proxies.filter(
        (proxy: ProxyWrapper<T>): boolean => !proxy.info && proxy.country.cca2 !== "UN",
      ),
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
      icon: icon("Info"),
    };
  },

  ai<T>(proxies: ProxyWrapper<T>[]): Group<T> {
    return {
      name: "AI",
      type: "url-test",
      proxies: proxies.filter(
        (proxy: ProxyWrapper<T>): boolean => !proxy.info && proxy.country.cca2 === "US",
      ),
      url: "https://api.openai.com",
      "expected-status": "421",
      icon: icon("AI"),
    };
  },

  crypto<T>(proxies: ProxyWrapper<T>[]): Group<T> {
    return {
      name: "Crypto",
      type: "url-test",
      proxies: proxies.filter(
        (proxy: ProxyWrapper<T>): boolean =>
          !proxy.info && CRYPTO_COUNTRIES.has(proxy.country.cca2),
      ),
      url: "https://api.binance.com/api/v3/ping",
      "expected-status": 200,
      icon: icon("Cryptocurrency"),
    };
  },
};
