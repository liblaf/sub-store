import { extendZodWithOpenApi } from "chanfana";
import z from "zod/v3";

extendZodWithOpenApi(z);

export const PARAMS_SCHEMA = z.object({
  id: z.string().uuid(),
  filename: z.string().openapi({ examples: ["mihomo.yaml", "stash.yaml"] }),
});
