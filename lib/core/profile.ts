import { z } from "zod";

import { REGEX_PATTERN_SCHEMA } from "./filter";
import { PROVIDER_SCHEMA } from "./provider";

export const PROFILE_ID_SCHEMA = z.union([
  z.string().regex(/^[0-9A-HJKMNP-TV-Z]{20}$/, "Expected a 20-character Crockford Base32 ID"),
  z.uuid(),
]);

export const PROFILE_TARGET_SCHEMA = z.enum(["mihomo", "stash"]);
export type ProfileTarget = z.infer<typeof PROFILE_TARGET_SCHEMA>;

const PROFILE_METADATA_SCHEMA = z.strictObject({
  id: PROFILE_ID_SCHEMA.optional(),
  target: PROFILE_TARGET_SCHEMA.optional(),
});

export const PROFILE_PROXY_SCHEMA = z.looseObject({
  name: z.string().min(1),
  type: z.string().min(1),
});

export const PROFILE_GROUP_SCHEMA = z.looseObject({
  name: z.string().min(1),
  type: z.string().min(1),
  proxies: z.array(z.string().min(1)).default([]),
  use: z.array(z.string().min(1)).default([]),
  filter: REGEX_PATTERN_SCHEMA.optional(),
  "exclude-filter": REGEX_PATTERN_SCHEMA.optional(),
  "exclude-type": z.string().optional(),
  "include-all": z.boolean().optional(),
  "include-all-proxies": z.boolean().optional(),
  "include-all-providers": z.boolean().optional(),
  "empty-fallback": z.string().min(1).optional(),
});

/** A complete native client configuration with optional build and publish metadata. */
export const PROFILE_SCHEMA = z
  .looseObject({
    "__sub-store": PROFILE_METADATA_SCHEMA.optional(),
    "sub-store": PROFILE_METADATA_SCHEMA.optional(),
    proxies: z.array(PROFILE_PROXY_SCHEMA).default([]),
    "proxy-groups": z.array(PROFILE_GROUP_SCHEMA).default([]),
    "proxy-providers": z
      .record(
        z
          .string()
          .min(1)
          .refine((name) => !name.startsWith("$"), {
            message: "Provider names starting with $ are reserved",
          }),
        PROVIDER_SCHEMA,
      )
      .default({}),
    "rule-providers": z.record(z.string(), z.unknown()).optional(),
    rules: z.array(z.string()).optional(),
  })
  .superRefine((profile, ctx) => {
    if (profile["__sub-store"] !== undefined && profile["sub-store"] !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["__sub-store"],
        message: "Use only __sub-store metadata",
      });
    }
  })
  .transform(({ "sub-store": legacy, ...profile }) => {
    const metadata = profile["__sub-store"] ?? legacy;
    return {
      ...profile,
      ...(metadata === undefined ? {} : { "__sub-store": metadata }),
    } as typeof profile & Record<string, unknown>;
  });

export type Profile = z.infer<typeof PROFILE_SCHEMA>;

export function assertProfileTarget(profile: Profile, target: ProfileTarget): void {
  const declared = profile["__sub-store"]?.target;
  if (declared !== undefined && declared !== target) {
    throw new Error(`Profile declares ${declared} but requested target is ${target}`);
  }
}
