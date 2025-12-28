import type { Profile } from "@shared/schema/profile";
import { ConfigStore } from "./config";

export class ProfileStore extends ConfigStore<Profile> {
  constructor(kv: KVNamespace) {
    super(kv, "profiles");
  }
}
