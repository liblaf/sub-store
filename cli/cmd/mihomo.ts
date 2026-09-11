import fs from "node:fs/promises";

import { Command } from "@commander-js/extra-typings";
import YAML from "yaml";

import type { Artifact } from "@/lib/core/builder";
import { PROFILE_SCHEMA } from "@/lib/core/profile";
import type { Profile } from "@/lib/core/profile";
import { writePrivateArtifact } from "@/lib/core/write-private-artifact";
import { MihomoBuilder } from "@/lib/formats/mihomo/builder";

type Opts = {
  output: string;
  template: string;
  providers: string;
};

export const mihomo: Command<[], Opts> = new Command("mihomo")
  .option("-o, --output <file>", "output artifact", "artifacts/mihomo.yaml")
  .option("-t, --template <file>", "JSON-e YAML template", "builtin://mihomo.yaml")
  .requiredOption("-p, --providers <file>", "provider profile")
  .action(async (options: Opts): Promise<void> => {
    const profile: Profile = PROFILE_SCHEMA.parse(
      YAML.parse(await fs.readFile(options.providers, "utf-8")),
    );
    const builder: MihomoBuilder = new MihomoBuilder({
      profile,
      template: options.template,
    });
    const artifact: Artifact = await builder.build();
    await writePrivateArtifact(options.output, artifact);
  });
