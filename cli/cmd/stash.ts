import { Command } from "@commander-js/extra-typings";

import { loadProfile } from "@/lib/core/load-profile";
import { writePrivateArtifact } from "@/lib/core/write-private-artifact";
import { buildProfile } from "@/lib/formats/build";

type Opts = { output: string };

export const stash = new Command("stash")
  .argument("<profile>", "native YAML profile")
  .option("-o, --output <file>", "output artifact", "artifacts/stash.yaml")
  .action(async (file: string, options: Opts): Promise<void> => {
    try {
      const artifact = await buildProfile(await loadProfile(file), "stash");
      await writePrivateArtifact(options.output, artifact);
    } catch {
      stash.error(
        "Failed to build Stash configuration; check the profile and provider availability",
      );
    }
  });
