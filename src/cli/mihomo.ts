import fs from "node:fs/promises";
import { buildCommand, type CommandContext } from "@stricli/core";
import YAML from "yaml";
import { z } from "zod/v4";
import { MihomoTemplate } from "../formats/mihomo";
import { GeoIP } from "../geoip";
import { defaultGroups, type Group } from "../groups";
import {
  CountryInferrer,
  EmbyInferrer,
  MultiplierInferrer,
  PlaceholderInferrer,
} from "../infer";
import type { Outbound } from "../outbound";
import type { ProfileParams } from "../store";
import { SubStore } from "../store";

type Flags = {
  key?: string;
  output: string;
  port: number;
  profile: SubStore;
  template: string;
};

const PORT_SCHEMA = z.coerce.number().int().min(1).max(65535).default(7890);

export const mihomo = buildCommand({
  docs: {
    brief: "mihomo",
  },
  async func(this: CommandContext, flags: Flags): Promise<void> {
    const template = new MihomoTemplate(flags.template, { port: flags.port });
    const geoip: GeoIP | undefined = flags.key
      ? new GeoIP({ key: flags.key })
      : undefined;
    const store: SubStore = flags.profile;
    const countryInferrer = new CountryInferrer({ geoip });
    const embyInferrer = new EmbyInferrer();
    const multiplierInferrer = new MultiplierInferrer();
    const placeholderInferrer = new PlaceholderInferrer();

    let outbounds: Outbound[] = await store.fetchMihomoOutbounds();
    await geoip?.bulk(
      outbounds.map((outbound: Outbound): string => outbound.server),
    ); // warmup GeoIP cache
    outbounds = await Promise.all(
      outbounds.map(async (outbound: Outbound): Promise<Outbound> => {
        outbound.country = (await countryInferrer.infer(outbound))?.cca2;
        outbound.emby = embyInferrer.infer(outbound);
        outbound.multiplier = multiplierInferrer.infer(outbound);
        outbound.placeholder = placeholderInferrer.infer(outbound);
        return outbound;
      }),
    );

    const groups: Group[] = defaultGroups();
    const mihomo: string = template.render(outbounds, groups);
    await fs.writeFile(flags.output, mihomo);
  },
  parameters: {
    flags: {
      key: {
        kind: "parsed",
        parse: String,
        brief: "key",
        default: undefined,
        optional: true,
      },
      output: {
        kind: "parsed",
        parse: String,
        brief: "output",
        default: "config.yaml",
      },
      port: {
        kind: "parsed",
        parse: PORT_SCHEMA.parse,
        brief: "port",
        default: "7890",
      },
      profile: {
        kind: "parsed",
        async parse(profile: string): Promise<SubStore> {
          const text: string = await fs.readFile(profile, "utf-8");
          const params: ProfileParams = YAML.parse(text);
          const store = new SubStore(params);
          return store;
        },
        brief: "profile",
        default: "profile.yaml",
      },
      template: {
        kind: "parsed",
        async parse(template: string): Promise<string> {
          const text: string = await fs.readFile(template, "utf-8");
          return text;
        },
        brief: "template",
        default: "templates/mihomo/default.yaml",
      },
    },
  },
});
