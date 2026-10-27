import fs from "node:fs/promises";

import { Command } from "@commander-js/extra-typings";
import YAML from "yaml";

import { assertProfileTarget, PROFILE_SCHEMA } from "@/lib/core/profile";
import { writePrivateArtifact } from "@/lib/core/write-private-artifact";
import { StashBuilder } from "@/lib/formats/stash/builder";

type Opts = { output: string };

export const stash = new Command("stash")
  .argument("<profile>", "native YAML profile")
  .option("-o, --output <file>", "output artifact", "artifacts/stash.yaml")
  .action(async (file: string, options: Opts): Promise<void> => {
    try {
      const profile = PROFILE_SCHEMA.parse(
        YAML.parse(await fs.readFile(file, "utf-8"), { merge: true }),
      );
      assertProfileTarget(profile, "stash");
      const artifact = await new StashBuilder({ profile }).build();
      await writePrivateArtifact(options.output, artifact);
    } catch {
      stash.error(
        "Failed to build Stash configuration; check the profile and provider availability",
      );
    }
  });
