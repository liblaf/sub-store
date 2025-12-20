import z from "zod";

export const PROFILE_SCHEMA = z.object({
  id: z.uuid(),
  providers: z.array(z.string()),
});

export type Profile = z.infer<typeof PROFILE_SCHEMA>;

export const PROFILES_SCHEMA = z.record(z.uuid(), PROFILE_SCHEMA);

export type Profiles = z.infer<typeof PROFILES_SCHEMA>;
