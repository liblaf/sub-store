import path from "node:path";

import { Command } from "@commander-js/extra-typings";

import { CliConfigError, resolvePublishConfig, subStoreConfigDir } from "@/cli/config";
import { publishProfiles } from "@/lib/publish";
import { PublishInputError } from "@/lib/publish/errors";

export const publish = new Command("publish")
  .description("Build and upload profile artifacts to the Worker")
  .argument("[path]", "profile file or recursive folder (default: ~/.config/sub-store/profiles)")
  .option("--config <path>", "TOML configuration file (default: ~/.config/sub-store/config.toml)")
  .addHelpText(
    "after",
    "\nConfiguration:\n  token               Upload token\n  base-url            Worker URL (default: https://subs.liblaf.me)\n\nEnvironment overrides:\n  SUB_STORE_API_TOKEN  Overrides token\n  SUB_STORE_URL        Overrides base-url\n\nThe default configuration folder follows XDG_CONFIG_HOME when set.",
  )
  .action(async (inputPath: string | undefined, options): Promise<void> => {
    try {
      const settings = await resolvePublishConfig({ configPath: options.config });
      const count = await publishProfiles(
        inputPath ?? path.join(subStoreConfigDir(), "profiles"),
        settings,
      );
      console.log(`Published ${count} profile file(s).`);
    } catch (error) {
      publish.error(
        error instanceof PublishInputError || error instanceof CliConfigError
          ? error.message
          : "Failed to publish profiles; check the profiles, upload settings, and provider availability",
      );
    }
  });
