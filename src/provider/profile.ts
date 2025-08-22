import fs from "node:fs/promises";
import YAML from "yaml";
import type { MihomoOutbound } from "../formats";
import { Provider } from "./provider";
import type { ProfileModel, ProviderOptions } from "./schema";
import { PROFILE_SCHEMA } from "./schema";

export class Profile {
  public providers: Provider[];

  static async load(file: string): Promise<Profile> {
    const data: string = await fs.readFile(file, "utf8");
    const parsed: any = YAML.parse(data);
    const profile: ProfileModel = PROFILE_SCHEMA.parse(parsed);
    return new Profile(profile.providers);
  }

  constructor(providers: ProviderOptions[]) {
    this.providers = providers.map(
      (options: ProviderOptions): Provider => new Provider(options),
    );
  }

  async fetchMihomoOutbounds(): Promise<MihomoOutbound[]> {
    const outbounds = await Promise.all(
      this.providers.map((provider) => provider.fetchOutboundsMihomo()),
    );
    return outbounds.flat();
  }
}
