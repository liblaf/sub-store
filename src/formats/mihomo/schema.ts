import z from "zod/v4";

export const DEFAULT_URL_TEST = "https://cp.cloudflare.com";

export const PORT_SCHEMA = z.int().min(1).max(65535);

export const MIHOMO_PROXY_SCHEMA = z.looseObject({
  name: z.string(),
  server: z.string(),
});
export type MihomoProxy = z.infer<typeof MIHOMO_PROXY_SCHEMA>;

export const MIHOMO_PROXY_GROUP_SCHEMA = z.looseObject({
  name: z.string(),
  type: z.enum(["select", "url-test"]),
  proxies: z.array(z.string()),
  url: z.url().default(DEFAULT_URL_TEST).optional(),
  interval: z.int().positive().default(300).optional(),
  lazy: z.boolean().default(true).optional(),
  icon: z.string().optional(),
});
export type MihomoProxyGroupOptions = z.input<typeof MIHOMO_PROXY_GROUP_SCHEMA>;
export type MihomoProxyGroup = z.infer<typeof MIHOMO_PROXY_GROUP_SCHEMA>;

export const MIHOMO_SCHEMA = z.looseObject({
  "mixed-port": PORT_SCHEMA.default(7892).optional(),
  proxies: z.array(MIHOMO_PROXY_SCHEMA).optional(),
  "proxy-groups": z.array(MIHOMO_PROXY_GROUP_SCHEMA).optional(),
});
export type Mihomo = z.infer<typeof MIHOMO_SCHEMA>;
