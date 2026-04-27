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

export function nameOverride<T extends ProxyWrapper>(
  proxies: T[],
  overrides: OverrideProxyName[],
): T[] {
  if (overrides.length === 0) return proxies;
  const regexps: OverrideProxyNameRegex[] = overrides.map(
    ({ pattern, target }: OverrideProxyName): OverrideProxyNameRegex => ({
      pattern: new RegExp(pattern),
      target,
    }),
  );
  return proxies.map((proxy: T): T => {
    let name: string = proxy.name;
    for (const { pattern, target } of regexps) name = name.replace(pattern, target);
    proxy.name = name;
    return proxy;
  });
}
