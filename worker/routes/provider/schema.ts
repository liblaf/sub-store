import z from "zod";

export const PROVIDER_SCHEMA = z.object({
  name: z.string(),
  jms: z.object({ url: z.url(), api: z.url() }).optional(),
  mihomo: z.url().optional(),
});

export type Provider = z.output<typeof PROVIDER_SCHEMA>;
