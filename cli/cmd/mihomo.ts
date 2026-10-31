import fs from "node:fs/promises";

import { Command } from "@commander-js/extra-typings";
import YAML from "yaml";

import { assertProfileTarget, PROFILE_SCHEMA } from "@/lib/core/profile";
import { writePrivateArtifact } from "@/lib/core/write-private-artifact";
import { MihomoBuilder } from "@/lib/formats/mihomo/builder";

type Opts = { output: string };

function createMihomoCommand(target: "mihomo" | "mihomo-smart") {
  const command = new Command(target)
    .argument("<profile>", "native YAML profile")
    .option("-o, --output <file>", "output artifact", `artifacts/${target}.yaml`)
    .action(async (file: string, options: Opts): Promise<void> => {
      try {
        const profile = PROFILE_SCHEMA.parse(
          YAML.parse(await fs.readFile(file, "utf-8"), { merge: true }),
        );
        assertProfileTarget(profile, target);
        const artifact = await new MihomoBuilder({ profile, target }).build();
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
