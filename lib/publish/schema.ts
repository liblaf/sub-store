import { z } from "zod";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ARTIFACT_SCHEMA = z.strictObject({
  body: z.string().min(1),
  metadata: z
    .strictObject({
      headers: z.strictObject({
        "Subscription-Userinfo": z
          .string()
          .regex(/^[\x20-\x7e]*$/)
          .optional(),
      }),
    })
    .refine(
      (metadata): boolean => new TextEncoder().encode(JSON.stringify(metadata)).byteLength <= 1024,
      {
        message: "Artifact metadata exceeds KV's 1 KiB limit",
      },
    ),
});

export const ARTIFACT_UPLOAD_SCHEMA = z.strictObject({
  mihomo: ARTIFACT_SCHEMA,
  stash: ARTIFACT_SCHEMA,
});

export type ArtifactUpload = z.infer<typeof ARTIFACT_UPLOAD_SCHEMA>;
