import { z } from "zod";

export const MIHOMO_PROXY_SCHEMA = z.looseObject({
  name: z.string(),
  type: z.string(),
});

export type MihomoProxy = z.infer<typeof MIHOMO_PROXY_SCHEMA>;

export const MIHOMO_PROXY_GROUP_SCHEMA = z.looseObject({
  name: z.string(),
  type: z.enum(["select", "url-test", "fallback", "load-balance"]),
  proxies: z.array(z.string()),
  url: z.string().optional(),
  lazy: z.boolean().optional(),
  "expected-status": z.union([z.number(), z.string()]).optional(),
  icon: z.string().optional(),
});

export type MihomoProxyGroup = z.infer<typeof MIHOMO_PROXY_GROUP_SCHEMA>;

export const MIHOMO_CONFIG_SCHEMA = z.looseObject({
  proxies: z.array(MIHOMO_PROXY_SCHEMA),
  "proxy-groups": z.array(MIHOMO_PROXY_GROUP_SCHEMA),
  rules: z.array(z.string()).optional(),
});

export type MihomoConfig = z.infer<typeof MIHOMO_CONFIG_SCHEMA>;

export const MIHOMO_SMART_PROXY_GROUP_SCHEMA = MIHOMO_PROXY_GROUP_SCHEMA.extend({
  type: z.enum([...MIHOMO_PROXY_GROUP_SCHEMA.shape.type.options, "smart"]),
});

export const MIHOMO_SMART_CONFIG_SCHEMA = MIHOMO_CONFIG_SCHEMA.extend({
  "proxy-groups": z.array(MIHOMO_SMART_PROXY_GROUP_SCHEMA),
});
