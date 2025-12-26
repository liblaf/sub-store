import z from "zod";

export const PROVIDER_SCHEMA = z.object({
  name: z.string(),
  bwcounter: z.string().url().optional(),
  mihomo: z.string().url().optional(),
  xray: z.string().url().optional(),
});

export type Provider = z.output<typeof PROVIDER_SCHEMA>;

export const PROVIDERS_SCHEMA = z.record(z.string(), PROVIDER_SCHEMA);

export type Providers = z.infer<typeof PROVIDERS_SCHEMA>;

export const USERINFO_SCHEMA = z.object({
  upload: z.number().optional(),
  download: z.number().optional(),
  total: z.number().optional(),
  expire: z.number().optional(),
});

export type Userinfo = z.infer<typeof USERINFO_SCHEMA>;
