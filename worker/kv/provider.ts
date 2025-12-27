import z from "zod/v3";
import { ConfigStore } from "./config";

export const PROVIDER_SCHEMA = z.object({
  id: z.string(),
  bwcounter: z.string().url().optional(),
  mihomo: z.string().url().optional(),
  xray: z.string().url().optional(),
});
export type Provider = z.infer<typeof PROVIDER_SCHEMA>;

export const PROVIDERS_SCHEMA = z.record(z.string(), PROVIDER_SCHEMA);
export type Providers = z.infer<typeof PROVIDERS_SCHEMA>;

export class ProviderStore extends ConfigStore<Provider> {
  constructor(kv: KVNamespace) {
    super(kv, "providers");
  }
}
