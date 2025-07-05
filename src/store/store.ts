import type { Outbound } from "../outbound";
import { Provider, type ProviderParams } from "../provider";
import {
  PROFILE_SCHEMA,
  type ProfileParams,
  type ProfileParsed,
} from "./schema";

export class SubStore {
  profile: ProfileParsed;
  providers: Provider[];

  constructor(profile: ProfileParams) {
    this.profile = PROFILE_SCHEMA.parse(profile);
    this.providers = this.profile.providers.map(
      (provider: ProviderParams): Provider => new Provider(provider),
    );
  }

  async fetchMihomoOutbounds(): Promise<Outbound[]> {
    throw new Error("Not Implemented");
  }

  async servers(): Promise<string[]> {
    throw new Error("Not Implemented");
  }
}
