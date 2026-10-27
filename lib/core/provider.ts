import { z } from "zod";

import { REGEX_PATTERN_SCHEMA } from "./filter";

const PROVIDER_METADATA_SCHEMA = z.strictObject({
  "strip-common-affixes": z.boolean().optional(),
  bwcounter: z.url().optional(),
  format: z.enum(["yaml", "mixed"]).optional(),
});

/** Options are stored under their provider name in `proxy-providers`. */
export const PROVIDER_SCHEMA = z
  .strictObject({
    url: z.url(),
    type: z.literal("http").optional(),
    headers: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
    filter: REGEX_PATTERN_SCHEMA.optional(),
    "exclude-filter": REGEX_PATTERN_SCHEMA.optional(),
    "exclude-type": z.string().optional(),
    override: z
      .strictObject({
        "additional-prefix": z.string().optional(),
        "additional-suffix": z.string().optional(),
        "proxy-name": z
          .array(
            z.strictObject({
              pattern: REGEX_PATTERN_SCHEMA,
              target: z.string(),
            }),
          )
          .optional(),
      })
      .optional(),
    "__sub-store": PROVIDER_METADATA_SCHEMA.optional(),
    "sub-store": PROVIDER_METADATA_SCHEMA.optional(),
  })
  .superRefine((provider, ctx) => {
    if (provider["__sub-store"] !== undefined && provider["sub-store"] !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["__sub-store"],
        message: "Use only __sub-store provider options",
      });
    }
  })
  .transform(({ "sub-store": legacy, ...provider }) => {
    const metadata = provider["__sub-store"] ?? legacy;
    return { ...provider, ...(metadata === undefined ? {} : { "__sub-store": metadata }) };
  });

export type ProviderOptions = z.infer<typeof PROVIDER_SCHEMA>;
