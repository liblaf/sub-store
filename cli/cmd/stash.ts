import fs from "node:fs/promises";
import path from "node:path";

import { Command } from "@commander-js/extra-typings";
import YAML from "yaml";

import type { Artifact } from "@/lib/core/builder";
import { PROFILE_SCHEMA } from "@/lib/core/profile";
import type { Profile } from "@/lib/core/profile";
import { StashBuilder } from "@/lib/formats/stash/builder";

type Opts = {
  output: string;
  template: string;
  providers: string;
};

export const stash: Command<[], Opts> = new Command("stash")
  .option("-o, --output <file>", "output artifact", "artifacts/stash.yaml")
  .option("-t, --template <file>", "JSON-e YAML template", "builtin://stash.yaml")
  .requiredOption("-p, --providers <file>", "provider profile")
  .action(async (options: Opts): Promise<void> => {
    const profile: Profile = PROFILE_SCHEMA.parse(
      YAML.parse(await fs.readFile(options.providers, "utf-8")),
    );
    const builder: StashBuilder = new StashBuilder({
      profile,
      template: options.template,
    });
    const artifact: Artifact = await builder.build();
    await fs.mkdir(path.dirname(options.output), { recursive: true });
    await fs.writeFile(options.output, artifact.body);
    const metadataFile: string = `${options.output}.metadata.json`;
    await fs.writeFile(metadataFile, JSON.stringify(artifact.metadata));
  });
