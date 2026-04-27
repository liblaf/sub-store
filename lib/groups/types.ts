import type { ProxyWrapper } from "@/lib/core/proxy";

export type Group<T> = {
  name: string;
  type: "select" | "url-test";
  proxies: ProxyWrapper<T>[];
  url?: string;
  "expected-status"?: number | string;
  icon?: string;
};

export type GroupFactory = <T>(proxies: ProxyWrapper<T>[]) => Group<T>;
