import { z } from "zod";

export const PROFILE_ID_SCHEMA = z.string().uuid();
export type ProfileId = z.infer<typeof PROFILE_ID_SCHEMA>;

export const PROFILE_SCHEMA = z.object({
  id: PROFILE_ID_SCHEMA,
  name: z.string().optional(),
  providers: z.array(z.string()),
});
export type Profile = z.infer<typeof PROFILE_SCHEMA>;

export const PROFILES_SCHEMA = z.record(PROFILE_ID_SCHEMA, PROFILE_SCHEMA);
export type Profiles = z.infer<typeof PROFILES_SCHEMA>;
