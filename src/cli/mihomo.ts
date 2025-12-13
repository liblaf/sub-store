import fs from "node:fs/promises";
import { buildCommand, type Command } from "@stricli/core";
import consola from "consola";
import type { MihomoOutbound } from "../formats";
import { MihomoTemplate } from "../formats";
import type { Group } from "../group";
import { defaultGroups } from "../group";
import type { Processor } from "../processor";
import { ProcessorCountry, ProcessorInfo } from "../processor";
import { Profile } from "../profile";
import type { Context } from "./context";

type Flags = {
  output: string;
  profile: string;
  template: string;
};

export const mihomo: Command<Context> = buildCommand({
  docs: { brief: "" },
  async func(this: Context, flags: Flags): Promise<void> {
    consola.level = 6;
    const groups: Group[] = defaultGroups();
    const profile = await Profile.load(flags.profile);
    const template: MihomoTemplate = await MihomoTemplate.load(flags.template);
    let outbounds: MihomoOutbound[] = await profile.fetchMihomoOutbounds();
    const processors: Processor[] = [
      new ProcessorCountry(),
      new ProcessorInfo(),
    ];
    for (const processor of processors)
      outbounds = await processor.process(outbounds);
    const config: string = template.render(outbounds, groups);
    await fs.writeFile(flags.output, config);
  },
  parameters: {
    flags: {
      output: {
        kind: "parsed",
        brief: "",
        parse: String,
        default: "mihomo.yaml",
      },
      profile: {
        kind: "parsed",
        brief: "",
        parse: String,
        default: "profile.yaml",
      },
      template: {
        kind: "parsed",
        brief: "",
        parse: String,
        default: "templates/mihomo/default.yaml",
      },
    },
  },
});
