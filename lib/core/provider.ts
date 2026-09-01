import { z } from "zod";

export const PROVIDER_SCHEMA = z
  .strictObject({
    name: z.string(),
    bwcounter: z.url().optional(),
    mihomo: z.url().optional(),
    mixed: z.url().optional(),
    override: z
      .strictObject({
        "proxy-name": z
          .array(
            z.strictObject({
              pattern: z.string(),
              target: z.string(),
            }),
          )
          .optional(),
      })
      .optional(),
  })
  .superRefine((provider, ctx): void => {
    const sourceCount: number =
      Number(provider.mihomo !== undefined) + Number(provider.mixed !== undefined);
    if (sourceCount !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "Provider must specify exactly one subscription source: mihomo or mixed",
        path: ["mihomo"],
      });
    }
  });

export type ProviderOptions = z.infer<typeof PROVIDER_SCHEMA>;
