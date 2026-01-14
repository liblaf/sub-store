import { z } from "zod";

export const PROVIDER_ID_SCHEMA = z.string();
export type ProviderId = z.infer<typeof PROVIDER_ID_SCHEMA>;

export const PROVIDER_SCHEMA = z.object({
  id: PROVIDER_ID_SCHEMA,
  bwcounter: z.url().optional(),
  mihomo: z.url().optional(),
  singbox: z.url().optional(),
  surge: z.url().optional(),
  xray: z.url().optional(),
});
export type Provider = z.infer<typeof PROVIDER_SCHEMA>;

export const PROVIDERS_SCHEMA = z.record(PROVIDER_ID_SCHEMA, PROVIDER_SCHEMA);
export type Providers = z.infer<typeof PROVIDERS_SCHEMA>;
