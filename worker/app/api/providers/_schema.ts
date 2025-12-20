import z from "zod";

export const PROVIDER_SCHEMA = z.object({
  name: z.string(),
  bwcounter: z.url().optional(),
  mihomo: z.url().optional(),
  xray: z.url().optional(),
});

export type Provider = z.output<typeof PROVIDER_SCHEMA>;
