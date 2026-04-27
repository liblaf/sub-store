import { z } from "zod";

export const STASH_PROXY_SCHEMA = z.looseObject({
  name: z.string(),
});

export type StashProxy = z.infer<typeof STASH_PROXY_SCHEMA>;

export const STASH_PROXY_GROUP_SCHEMA = z.looseObject({
  name: z.string(),
  type: z.enum(["select", "url-test"]),
  proxies: z.array(z.string()),
  "benchmark-url": z.string().optional(),
  lazy: z.boolean().optional(),
  icon: z.string().optional(),
});

export type StashProxyGroup = z.infer<typeof STASH_PROXY_GROUP_SCHEMA>;

export const STASH_CONFIG_SCHEMA = z.looseObject({
  proxies: z.array(STASH_PROXY_SCHEMA),
  "proxy-groups": z.array(STASH_PROXY_GROUP_SCHEMA),
});

export type StashConfig = z.infer<typeof STASH_CONFIG_SCHEMA>;
