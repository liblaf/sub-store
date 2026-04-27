interface ProxyWrapper {
  name: string;
  pretty: string;
}

export function namePretty<T extends ProxyWrapper>(proxies: T[], prefix: string): T[] {
  return proxies.map((proxy: T): T => {
    proxy.pretty = `[${prefix}] ${proxy.name}`;
    return proxy;
  });
}
