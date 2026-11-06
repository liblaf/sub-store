import { compilePattern } from "../core/filter";
import type { ProviderOptions } from "../core/provider";
import type { ProxyWrapper } from "../core/proxy";
import type { NativeProxy } from "../core/template";
import { normalizeProviderProxies } from "./name";

/** Prepare copied Provider Proxies for one profile's expansion. */
export function prepareProviderProxies<T extends NativeProxy>(
  proxies: readonly ProxyWrapper<T>[],
  provider: ProviderOptions,
): ProxyWrapper<T>[] {
  const prepared = proxies.map((proxy) => ({ ...proxy, wrapped: { ...proxy.wrapped } }));
  const sourceNames = prepared.map((proxy) => proxy.name);
  normalizeProviderProxies(prepared, provider);
  const names = new Map(
    sourceNames.map((sourceName, index) => [sourceName, prepared[index]!.name]),
  );
  const skipCertVerify = provider.override?.["skip-cert-verify"];
  for (const proxy of prepared) {
    const dialer = proxy.wrapped["dialer-proxy"];
    if (typeof dialer === "string" && names.has(dialer)) {
      proxy.wrapped = { ...proxy.wrapped, "dialer-proxy": names.get(dialer)! };
    }
    if (skipCertVerify !== undefined) {
      proxy.wrapped = { ...proxy.wrapped, "skip-cert-verify": skipCertVerify };
    }
  }
  const include = provider.filter === undefined ? undefined : compilePattern(provider.filter);
  const exclude =
    provider["exclude-filter"] === undefined
      ? undefined
      : compilePattern(provider["exclude-filter"]);
  const excludedTypes = new Set(
    (provider["exclude-type"] ?? "")
      .split("|")
      .filter(Boolean)
      .map((type) => type.toLowerCase()),
  );
  return prepared.filter(
    (proxy) =>
      (!include || include.test(proxy.name)) &&
      !exclude?.test(proxy.name) &&
      !excludedTypes.has(proxy.wrapped.type.toLowerCase()),
  );
}
