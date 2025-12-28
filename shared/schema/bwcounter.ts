import { z } from "zod/v3";

export const BWCOUNTER_SCHEMA = z.object({});
export type BWCounter = z.infer<typeof BWCOUNTER_SCHEMA>;
