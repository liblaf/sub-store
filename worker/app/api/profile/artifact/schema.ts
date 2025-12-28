import { PROFILE_ID_SCHEMA } from "@shared/schema/profile";
import { z } from "zod/v3";

export const PARAMS_SCHEMA = z.object({
  id: PROFILE_ID_SCHEMA,
  filename: z.string().openapi({ examples: ["mihomo.yaml", "stash.yaml"] }),
});
