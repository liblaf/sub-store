import { z } from "zod/v3";

export const PROVIDER_ID = z.string();
export type ProviderId = z.infer<typeof PROVIDER_ID>;

export const PROVIDER_SCHEMA = z.object({
  id: PROVIDER_ID,
  bwcounter: z.string().url().optional(),
  mihomo: z.string().url().optional(),
  singbox: z.string().url().optional(),
  surge: z.string().url().optional(),
  xray: z.string().url().optional(),
});
export type Provider = z.infer<typeof PROVIDER_SCHEMA>;

export const PROVIDERS_SCHEMA = z.record(PROVIDER_ID, PROVIDER_SCHEMA);
export type Providers = z.infer<typeof PROVIDERS_SCHEMA>;
