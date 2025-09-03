import { z } from "zod";

export const PROVIDER_SCHEMA: z.ZodObject<{
  name: z.ZodString;
  free: z.ZodDefault<z.ZodBoolean>;
  jms: z.ZodOptional<z.ZodObject<{ url: z.ZodURL }, z.core.$strip>>;
  mihomo: z.ZodOptional<z.ZodObject<{ url: z.ZodURL }, z.core.$strip>>;
}> = z.object({
  name: z.string(),
  free: z.boolean().default(false),
  jms: z.object({ url: z.url() }).optional(),
  mihomo: z.object({ url: z.url() }).optional(),
});
export type ProviderOptions = z.input<typeof PROVIDER_SCHEMA>;

export const PROFILE_SCHEMA: z.ZodObject<{
  providers: z.ZodArray<
    z.ZodObject<
      {
        name: z.ZodString;
        free: z.ZodDefault<z.ZodBoolean>;
        jms: z.ZodOptional<z.ZodObject<{ url: z.ZodURL }, z.core.$strip>>;
        mihomo: z.ZodOptional<z.ZodObject<{ url: z.ZodURL }, z.core.$strip>>;
      },
      z.core.$strip
    >
  >;
}> = z.object({
  providers: z.array(PROVIDER_SCHEMA),
});
export type ProfileModel = z.infer<typeof PROFILE_SCHEMA>;
