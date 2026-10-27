interface ProxyWrapper {
  name: string;
}

/** Strip affixes shared by the entire original list, preserving Unicode code points. */
export function nameStripCommonAffixes<T extends ProxyWrapper>(proxies: T[]): T[] {
  if (proxies.length < 2) return proxies;
  const names: string[][] = proxies.map(({ name }: T): string[] => Array.from(name));
  const first: string[] = names[0]!;
  const minLength: number = Math.min(...names.map((name: string[]): number => name.length));
  let prefixLength: number = 0;
  while (
    prefixLength < minLength &&
    names.every((name: string[]): boolean => name[prefixLength] === first[prefixLength])
  ) {
    prefixLength++;
  }
  let suffixLength: number = 0;
  while (
    suffixLength < minLength &&
    names.every(
      (name: string[]): boolean =>
        name[name.length - 1 - suffixLength] === first[first.length - 1 - suffixLength],
    )
  ) {
    suffixLength++;
  }
  if (names.some((name: string[]): boolean => name.length <= prefixLength + suffixLength)) {
    return proxies;
  }
  return proxies.map((proxy: T, index: number): T => {
    const name: string[] = names[index]!;
    proxy.name = name.slice(prefixLength, name.length - suffixLength).join("");
    return proxy;
  });
}
