import z from "zod";

export const MIHOMO_NODE_SCHEMA: z.ZodObject<{
  name: z.ZodString;
  type: z.ZodString;
  server: z.ZodString;
}> = z.looseObject({
  name: z.string(),
  type: z.string(),
  server: z.string(),
});
export type MihomoNode = z.infer<typeof MIHOMO_NODE_SCHEMA>;
export type MihomoNodeOptions = z.input<typeof MIHOMO_NODE_SCHEMA>;

export const MIHOMO_PROXY_GROUP_SCHEMA: z.ZodObject<{
  name: z.ZodString;
  type: z.ZodEnum<{
    select: "select";
    "url-test": "url-test";
  }>;
  proxies: z.ZodArray<z.ZodString>;
  url: z.ZodDefault<z.ZodURL>;
  lazy: z.ZodDefault<z.ZodBoolean>;
  "expected-status": z.ZodDefault<z.ZodInt>;
  icon: z.ZodOptional<z.ZodURL>;
}> = z.looseObject({
  name: z.string(),
  type: z.enum(["select", "url-test"]),
  proxies: z.array(z.string()),
  url: z.url().default("https://cp.cloudflare.com"),
  lazy: z.boolean().default(true),
  "expected-status": z.int().min(100).max(599).default(204),
  icon: z.url().optional(),
});
export type MihomoProxyGroup = z.infer<typeof MIHOMO_PROXY_GROUP_SCHEMA>;
export type MihomoProxyGroupOptions = z.input<typeof MIHOMO_PROXY_GROUP_SCHEMA>;

export const MIHOMO_SCHEMA: z.ZodObject<{
  proxies: z.ZodOptional<
    z.ZodArray<
      z.ZodObject<{
        name: z.ZodString;
        type: z.ZodString;
        server: z.ZodString;
      }>
    >
  >;
  "proxy-groups": z.ZodOptional<
    z.ZodArray<
      z.ZodObject<{
        name: z.ZodString;
        type: z.ZodEnum<{
          select: "select";
          "url-test": "url-test";
        }>;
        proxies: z.ZodArray<z.ZodString>;
        url: z.ZodDefault<z.ZodURL>;
        lazy: z.ZodDefault<z.ZodBoolean>;
        "expected-status": z.ZodDefault<z.ZodInt>;
        icon: z.ZodOptional<z.ZodURL>;
      }>
    >
  >;
  rules: z.ZodOptional<z.ZodArray<z.ZodString>>;
}> = z.looseObject({
  proxies: z.array(MIHOMO_NODE_SCHEMA).optional(),
  "proxy-groups": z.array(MIHOMO_PROXY_GROUP_SCHEMA).optional(),
  rules: z.array(z.string()).optional(),
});
export type Mihomo = z.infer<typeof MIHOMO_SCHEMA>;
