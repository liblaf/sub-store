import z from "zod";
import { PROVIDER_SCHEMA } from "../provider";

export const PROFILE_SCHEMA = z.object({
  providers: z.array(PROVIDER_SCHEMA),
});
export type ProfileParams = z.input<typeof PROFILE_SCHEMA>;
export type ProfileParsed = z.output<typeof PROFILE_SCHEMA>;
