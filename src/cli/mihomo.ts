import fs from "node:fs/promises";
import { buildCommand } from "@stricli/core";
import consola from "consola";
import { type MihomoOutbound, MihomoTemplate } from "../formats";
import { type Group, newGroups } from "../group";
import { InferrerContainer } from "../infer";
import { Profile } from "../provider";
import type { Context } from "./context";

type Flags = {
  output: string;
  profile: string;
  template: string;
};

export const mihomo = buildCommand({
  docs: { brief: "" },
  async func(this: Context, flags: Flags): Promise<void> {
    consola.level = 6;
    const groups: Group[] = newGroups();
    const profile = await Profile.load(flags.profile);
    const template: MihomoTemplate = await MihomoTemplate.load(flags.template);
    let outbounds: MihomoOutbound[] = await profile.fetchMihomoOutbounds();
    const inferrer = new InferrerContainer();
    outbounds = await inferrer.inferBulk(outbounds);
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
