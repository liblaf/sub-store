import z from "zod/v3";

export const PROVIDER_SCHEMA = z.object({
  name: z.string(),
  bwcounter: z.string().url().optional(),
  mihomo: z.string().url().optional(),
  xray: z.string().url().optional(),
});
export type Provider = z.infer<typeof PROVIDER_SCHEMA>;

export const PROVIDERS_SCHEMA = z.record(z.string(), PROVIDER_SCHEMA);
export type Providers = z.infer<typeof PROVIDERS_SCHEMA>;
