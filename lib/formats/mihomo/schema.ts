import { z } from "zod";

export const MIHOMO_PROXY_SCHEMA = z.looseObject({
  name: z.string(),
});

export type MihomoProxy = z.infer<typeof MIHOMO_PROXY_SCHEMA>;

export const MIHOMO_PROXY_GROUP_SCHEMA = z.looseObject({
  name: z.string(),
  type: z.enum(["select", "url-test"]),
  proxies: z.array(z.string()),
  url: z.string().optional(),
  "expected-status": z.union([z.number(), z.string()]).optional(),
  icon: z.string().optional(),
});

export type MihomoProxyGroup = z.infer<typeof MIHOMO_PROXY_GROUP_SCHEMA>;

export const MIHOMO_CONFIG_SCHEMA = z.looseObject({
  proxies: z.array(MIHOMO_PROXY_SCHEMA),
  "proxy-groups": z.array(MIHOMO_PROXY_GROUP_SCHEMA),
});

export type MihomoConfig = z.infer<typeof MIHOMO_CONFIG_SCHEMA>;
