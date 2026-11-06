import { Command } from "@commander-js/extra-typings";

import { loadProfile } from "@/lib/core/load-profile";
import { writePrivateArtifact } from "@/lib/core/write-private-artifact";
import { buildProfile } from "@/lib/formats/build";

type Opts = { output: string };

function createMihomoCommand(target: "mihomo" | "mihomo-smart") {
  const command = new Command(target)
    .argument("<profile>", "native YAML profile")
    .option("-o, --output <file>", "output artifact", `artifacts/${target}.yaml`)
    .action(async (file: string, options: Opts): Promise<void> => {
      try {
        const artifact = await buildProfile(await loadProfile(file), target);
        await writePrivateArtifact(options.output, artifact);
      } catch {
        const label = target === "mihomo-smart" ? "Mihomo Smart" : "Mihomo";
        command.error(
          `Failed to build ${label} configuration; check the profile, mihomo executable, and provider availability`,
        );
      }
    });
  return command;
}

export const mihomo = createMihomoCommand("mihomo");
export const mihomoSmart = createMihomoCommand("mihomo-smart");
