import { z } from "zod";

import { PROVIDER_SCHEMA } from "./provider";

export const PROFILE_ID_SCHEMA = z.union([
  z.string().regex(/^[0-9A-HJKMNP-TV-Z]{20}$/, "Expected a 20-character Crockford Base32 ID"),
  z.uuid(),
]);

export const PROFILE_SCHEMA = z
  .strictObject({
    id: PROFILE_ID_SCHEMA,
    providers: z.array(PROVIDER_SCHEMA),
  })
  .superRefine(({ providers }, ctx): void => {
    const names = new Set<string>();
    for (const [index, provider] of providers.entries()) {
      if (names.has(provider.name)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate provider name: ${provider.name}`,
          path: ["providers", index, "name"],
        });
      }
      names.add(provider.name);
    }
  });

export type Profile = z.infer<typeof PROFILE_SCHEMA>;
