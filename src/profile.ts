import fs from "node:fs/promises";
import YAML from "yaml";
import { z } from "zod";
import { Provider } from "./core";
import type { MihomoOutbound } from "./formats";

export const PROVIDER_SCHEMA: z.ZodObject<{
  name: z.ZodString;
  free: z.ZodDefault<z.ZodBoolean>;
  jms: z.ZodOptional<z.ZodObject<{ url: z.ZodURL }>>;
  mihomo: z.ZodOptional<z.ZodObject<{ url: z.ZodURL }>>;
}> = z.object({
  name: z.string(),
  free: z.boolean().default(false),
  jms: z.object({ url: z.url() }).optional(),
  mihomo: z.object({ url: z.url() }).optional(),
});
export type ProviderOptions = z.input<typeof PROVIDER_SCHEMA>;

export const PROFILE_SCHEMA: z.ZodObject<{
  providers: z.ZodArray<typeof PROVIDER_SCHEMA>;
}> = z.object({
  providers: z.array(PROVIDER_SCHEMA),
});
export type ProfileModel = z.infer<typeof PROFILE_SCHEMA>;

export class Profile {
  public providers: Provider[];

  static async load(file: string): Promise<Profile> {
    const data: string = await fs.readFile(file, "utf8");
    const parsed: any = YAML.parse(data);
    const profile: ProfileModel = PROFILE_SCHEMA.parse(parsed);
    return new Profile(profile.providers);
  }

  constructor(providers: readonly ProviderOptions[]) {
    this.providers = providers.map(
      (options: ProviderOptions): Provider => new Provider(options),
    );
  }

  async fetchMihomoOutbounds(): Promise<MihomoOutbound[]> {
    const outbounds: MihomoOutbound[][] = await Promise.all(
      this.providers.map(
        async (provider: Provider): Promise<MihomoOutbound[]> =>
          await provider.fetchOutboundsMihomo(),
      ),
    );
    return outbounds.flat();
  }
}
