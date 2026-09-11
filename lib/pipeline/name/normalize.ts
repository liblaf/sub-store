import { nameStripCommonAffixes } from "./strip-common-affixes";

interface ProxyWrapper {
  name: string;
}

type OverrideProxyName = {
  pattern: string;
  target: string;
};

type OverrideProxyNameRegex = {
  pattern: RegExp;
  target: string;
};

export function nameNormalize<T extends ProxyWrapper>(
  proxies: T[],
  overrides: OverrideProxyName[],
): T[] {
  if (overrides.length === 0) return nameStripCommonAffixes(proxies);
  const regexps: OverrideProxyNameRegex[] = overrides.map(
    ({ pattern, target }: OverrideProxyName): OverrideProxyNameRegex => ({
      pattern: new RegExp(pattern),
      target,
    }),
  );
  // Compute automatic names from the full original list before overrides mutate it.
  const stripped: ProxyWrapper[] = nameStripCommonAffixes(
    proxies.map(({ name }: T): ProxyWrapper => ({ name })),
  );
  return proxies.map((proxy: T, index: number): T => {
    let name: string = proxy.name;
    let matched: boolean = false;
    for (const { pattern, target } of regexps) {
      if (!pattern.test(name)) continue;
      name = name.replace(pattern, target);
      matched = true;
    }
    // Even a no-op replacement claims the name and prevents automatic stripping.
    proxy.name = matched ? name : stripped[index]!.name;
    return proxy;
  });
}
