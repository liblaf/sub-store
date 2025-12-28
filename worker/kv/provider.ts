import type { Provider } from "@shared/schema/provider";
import { ConfigStore } from "./config";

export class ProviderStore extends ConfigStore<Provider> {
  constructor(kv: KVNamespace) {
    super(kv, "providers");
  }
}
