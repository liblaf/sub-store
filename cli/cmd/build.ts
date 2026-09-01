import { Command } from "@commander-js/extra-typings";

import { mihomo } from "./mihomo";
import { stash } from "./stash";

export const build: Command = new Command("build")
  .description("Build subscription artifacts")
  .addCommand(mihomo)
  .addCommand(stash);
