import { compilePattern } from "../../core/filter";
import type { ProviderOptions } from "../../core/provider";
import { nameStripCommonAffixes } from "./strip-common-affixes";

interface ProxyWrapper {
  name: string;
  pretty?: string;
}

type OverrideProxyName = {
  pattern: string;
  target: string;
};

/** Apply explicitly ordered replacements to names. */
export function nameNormalize<T extends ProxyWrapper>(
  proxies: T[],
  overrides: OverrideProxyName[],
): T[] {
  const regexps = overrides.map(({ pattern, target }: OverrideProxyName) => ({
    pattern: compilePattern(pattern),
    target,
  }));
  return proxies.map((proxy: T): T => {
    for (const { pattern, target } of regexps) {
      proxy.name = proxy.name.replace(pattern, target);
    }
    return proxy;
  });
}

/** Normalize one complete provider before group selection. */
export function normalizeProviderProxies<T extends ProxyWrapper>(
  proxies: T[],
  provider: ProviderOptions,
): T[] {
  if (provider["__sub-store"]?.["strip-common-affixes"]) {
    nameStripCommonAffixes(proxies);
  }
  nameNormalize(proxies, provider.override?.["proxy-name"] ?? []);
  const prefix: string = provider.override?.["additional-prefix"] ?? "";
  const suffix: string = provider.override?.["additional-suffix"] ?? "";
  return proxies.map((proxy: T): T => {
    proxy.name = `${prefix}${proxy.name}${suffix}`;
    if ("pretty" in proxy) proxy.pretty = proxy.name;
    return proxy;
  });
}
