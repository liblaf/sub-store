import { z } from "zod";

export const BWCOUNTER_SCHEMA = z.object({
  monthly_bw_limit_b: z.number().int(),
  bw_counter_b: z.number().int(),
  bw_reset_day_of_month: z.number().int(),
});
export type BWCounter = z.infer<typeof BWCOUNTER_SCHEMA>;
