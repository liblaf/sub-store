interface ProxyWrapper {
  name: string;
}

export function nameStripCommonAffixes<T extends ProxyWrapper>(proxies: T[]): T[] {
  const names: string[] = proxies.map((proxy: T): string => proxy.name);
  const prefix: string = longestCommonPrefix(names);
  const suffix: string = longestCommonSuffix(names);
  return proxies.map((proxy: T): T => {
    proxy.name = proxy.name.slice(prefix.length, proxy.name.length - suffix.length);
    return proxy;
  });
}

function longestCommonPrefix(names: string[]): string {
  if (names.length === 0) return "";
  const first: string = names[0]!;
  const minLength: number = Math.min(...names.map((name: string): number => name.length));
  for (let i: number = 0; i < minLength; i++) {
    const char: string = first[i]!;
    if (names.some((name: string): boolean => name[i] !== char)) return first.slice(0, i);
  }
  return first.slice(0, minLength);
}

function longestCommonSuffix(names: string[]): string {
  if (names.length === 0) return "";
  const first: string = names[0]!;
  const minLength: number = Math.min(...names.map((name: string): number => name.length));
  for (let i: number = 0; i < minLength; i++) {
    const char: string = first[first.length - 1 - i]!;
    if (names.some((name: string): boolean => name[name.length - 1 - i] !== char)) {
      return first.slice(first.length - i);
    }
  }
  return first.slice(first.length - minLength);
}
