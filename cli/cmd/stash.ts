import fs from "node:fs/promises";
import path from "node:path";

import { Command } from "@commander-js/extra-typings";
import YAML from "yaml";

import type { Artifact } from "@/lib/core/builder";
import { StashBuilder } from "@/lib/formats/stash/builder";

type Opts = {
  group: string[];
  output: string;
  template: string;
  profile: string;
};

export const stash: Command<[], Opts> = new Command("stash")
  .option("-g, --group <groups...>", "", ["Auto", "Info", "AI", "Crypto", "COUNTRIES"])
  .option("-o, --output <file>", "", "artifacts/stash.yaml")
  .option("-t, --template <file>", "", "builtin://stash.yaml")
  .requiredOption("-p, --profile <file>")
  .action(async (options: Opts): Promise<void> => {
    const builder: StashBuilder = new StashBuilder({
      groups: options.group,
      profile: YAML.parse(await fs.readFile(options.profile, "utf-8")),
      template: options.template,
    });
    const artifact: Artifact = await builder.build();
    await fs.mkdir(path.dirname(options.output), { recursive: true });
    await fs.writeFile(options.output, artifact.body);
    const metadataFile: string = `${options.output}.metadata.json`;
    await fs.writeFile(metadataFile, JSON.stringify(artifact.metadata));
  });
