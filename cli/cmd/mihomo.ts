import fs from "node:fs/promises";

import { Command } from "@commander-js/extra-typings";
import YAML from "yaml";

import { assertProfileTarget, PROFILE_SCHEMA } from "@/lib/core/profile";
import { writePrivateArtifact } from "@/lib/core/write-private-artifact";
import { MihomoBuilder } from "@/lib/formats/mihomo/builder";

type Opts = { output: string };

export const mihomo = new Command("mihomo")
  .argument("<profile>", "native YAML profile")
  .option("-o, --output <file>", "output artifact", "artifacts/mihomo.yaml")
  .action(async (file: string, options: Opts): Promise<void> => {
    try {
      const profile = PROFILE_SCHEMA.parse(
        YAML.parse(await fs.readFile(file, "utf-8"), { merge: true }),
      );
      assertProfileTarget(profile, "mihomo");
      const artifact = await new MihomoBuilder({ profile }).build();
      await writePrivateArtifact(options.output, artifact);
    } catch {
      mihomo.error(
        "Failed to build Mihomo configuration; check the profile and provider availability",
      );
    }
  });
