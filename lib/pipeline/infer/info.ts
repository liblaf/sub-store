import consola from "consola";

interface ProxyWrapper {
  name: string;
  info: boolean;
}

export function inferInfo<T extends ProxyWrapper>(proxies: T[]): T[] {
  const PATTERN: RegExp = /Expire|Remaining|Traffic|Updated|剩余流量|套餐到期/i;
  return proxies.map((proxy: T): T => {
    proxy.info = PATTERN.test(proxy.name);
    if (proxy.info) consola.success(`${proxy.name} ~ /INFO/`);
    return proxy;
  });
}
