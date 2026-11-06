import { z } from "zod";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const HEADER_VALUE_SCHEMA = z
  .string()
  .refine((value) => !/[^\x20-\x7e]/.test(value), "Expected printable ASCII header value");

const ARTIFACT_SCHEMA = z.strictObject({
  body: z.string().min(1),
  metadata: z
    .strictObject({
      headers: z.strictObject({
        "Content-Disposition": HEADER_VALUE_SCHEMA.optional(),
        "Profile-Update-Interval": HEADER_VALUE_SCHEMA.regex(/^[1-9][0-9]*$/)
          .refine((value) => Number.isSafeInteger(Number(value)))
          .optional(),
        "Profile-Web-Page-Url": HEADER_VALUE_SCHEMA.pipe(z.httpUrl()).optional(),
        "Subscription-Userinfo": HEADER_VALUE_SCHEMA.optional(),
      }),
    })
    .refine(
      (metadata): boolean => new TextEncoder().encode(JSON.stringify(metadata)).byteLength <= 1024,
      {
        message: "Artifact metadata exceeds KV's 1 KiB limit",
      },
    ),
});

export const ARTIFACT_UPLOAD_SCHEMA = z
  .strictObject({
    mihomo: ARTIFACT_SCHEMA.optional(),
    "mihomo-smart": ARTIFACT_SCHEMA.optional(),
    stash: ARTIFACT_SCHEMA.optional(),
  })
  .refine((artifacts) => Object.values(artifacts).some((artifact) => artifact !== undefined), {
    message: "At least one artifact is required",
  });

export type ArtifactUpload = z.infer<typeof ARTIFACT_UPLOAD_SCHEMA>;
