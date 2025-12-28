import { z } from "zod/v3";

export const USERINFO_SCHEMA = z
  .object({
    upload: z.number().optional(),
    download: z.number().optional(),
    total: z.number().optional(),
    expire: z.number().optional(),
  })
  .catchall(z.string());
export type Userinfo = z.infer<typeof USERINFO_SCHEMA>;
