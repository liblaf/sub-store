import z from "zod";

export const MIHOMO_OUTBOUND_SCHEMA = z.object({
  name: z.string(),
  type: z.string(),
  server: z.string(),
});
export type MihomoOutbound = z.infer<typeof MIHOMO_OUTBOUND_SCHEMA>;

export const MIHOMO_GROUP_SCHEMA = z
  .object({
    name: z.string(),
    type: z.enum(["select", "url-test"]),
    proxies: z.array(z.string()),
    url: z.string().url().default("https://cp.cloudflare.com"),
    lazy: z.boolean().default(true),
    "expected-status": z.number().int().min(100).max(599).default(204),
    icon: z.string().url().optional(),
  })
  .passthrough();
export type MihomoGroup = z.infer<typeof MIHOMO_GROUP_SCHEMA>;

export const MIHOMO_CONFIG_SCHEMA = z.object({
  proxies: z.array(MIHOMO_OUTBOUND_SCHEMA).optional(),
  "proxy-groups": z.array(MIHOMO_GROUP_SCHEMA).optional(),
  rules: z.array(z.string()).optional(),
});
export type MihomoConfig = z.infer<typeof MIHOMO_CONFIG_SCHEMA>;
