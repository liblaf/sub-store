#!/usr/bin/env bun
import { program } from "@commander-js/extra-typings";

import { build } from "@/cli/cmd/build";
import { publish } from "@/cli/cmd/publish";
import { description, version } from "@/package.json";

program
  .name("sub-store")
  .description(description)
  .version(version)
  .addCommand(build)
  .addCommand(publish);
await program.parseAsync();
