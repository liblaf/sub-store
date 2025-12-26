import z from "zod/v3";

export const PROFILE_SCHEMA = z.object({
  id: z.string(),
  name: z.string().optional(),
  providers: z.array(z.string()),
});

export type Profile = z.infer<typeof PROFILE_SCHEMA>;

export const PROFILES_SCHEMA = z.record(z.string(), PROFILE_SCHEMA);

export type Profiles = z.infer<typeof PROFILES_SCHEMA>;
