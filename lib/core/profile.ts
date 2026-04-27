import { z } from "zod";

import { PROVIDER_SCHEMA } from "./provider";

export const PROFILE_SCHEMA = z.object({
  id: z.uuid(),
  providers: z.array(PROVIDER_SCHEMA),
});

export type Profile = z.infer<typeof PROFILE_SCHEMA>;
