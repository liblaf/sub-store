import fs from "node:fs/promises";

import { Command } from "@commander-js/extra-typings";
import YAML from "yaml";

import { MihomoBuilder } from "@/lib/formats/mihomo/builder";

type Opts = {
  group: string[];
  output?: string;
  template: string;
  profile: string;
};

export const mihomo: Command<[], Opts> = new Command("mihomo")
  .option("-g, --group <groups...>", "", ["Auto", "Info", "AI", "COUNTRIES"])
  .option("-o, --output <file>")
  .option("-t, --template <file>", "", "builtin://mihomo.yaml")
  .requiredOption("-p, --profile <file>")
  .action(async (options: Opts): Promise<void> => {
    const builder: MihomoBuilder = new MihomoBuilder({
      groups: options.group,
      profile: YAML.parse(await fs.readFile(options.profile, "utf-8")),
      template: options.template,
    });
    const artifact: string = await builder.build();
    if (options.output) {
      await fs.writeFile(options.output, artifact);
    } else {
      process.stdout.write(artifact);
    }
  });
