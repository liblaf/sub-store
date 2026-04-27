import { z } from "zod";

export const PROVIDER_SCHEMA = z.object({
  name: z.string(),
  bwcounter: z.url().optional(),
  mihomo: z.url().optional(),
  mixed: z.url().optional(),
  override: z
    .object({
      "proxy-name": z
        .array(
          z.object({
            pattern: z.string(),
            target: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export type ProviderOptions = z.infer<typeof PROVIDER_SCHEMA>;
