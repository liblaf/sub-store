interface ProxyWrapper {
  name: string;
  info: boolean;
}

export function inferInfo<T extends ProxyWrapper>(proxies: T[]): T[] {
  const pattern: RegExp = /Upload|Download|Total|Expire/;
  return proxies.map((proxy: T): T => {
    proxy.info = pattern.test(proxy.name);
    return proxy;
  });
}
