#!/usr/bin/env bun
import { program } from "@commander-js/extra-typings";

import { mihomo } from "@/cli/cmd/mihomo";
import { stash } from "@/cli/cmd/stash";
import { description, version } from "@/package.json";

program
  .name("sub-store")
  .description(description)
  .version(version)
  .addCommand(mihomo)
  .addCommand(stash);
await program.parseAsync();
