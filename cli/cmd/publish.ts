import os from "node:os";
import path from "node:path";

import { Command } from "@commander-js/extra-typings";

import { publishProfiles } from "@/lib/publish";

export const publish = new Command("publish")
  .description("Build and upload profile artifacts to the Worker")
  .argument("[path]", "profile file or folder (default: ~/.config/sub-store/profiles)")
  .addHelpText(
    "after",
    "\nEnvironment:\n  SUB_STORE_API_TOKEN  Required upload token\n  SUB_STORE_URL        Worker URL (default: https://subs.liblaf.me)",
  )
  .action(async (inputPath?: string): Promise<void> => {
    try {
      const token = process.env.SUB_STORE_API_TOKEN;
      if (!token?.trim()) throw new Error("SUB_STORE_API_TOKEN is required");
      const count = await publishProfiles(
        inputPath ?? path.join(os.homedir(), ".config", "sub-store", "profiles"),
        { url: process.env.SUB_STORE_URL ?? "https://subs.liblaf.me", token },
      );
      console.log(`Published ${count} profile(s).`);
    } catch (error) {
      publish.error(error instanceof Error ? error.message : String(error));
    }
  });
