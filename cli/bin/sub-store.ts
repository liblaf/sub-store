#!/usr/bin/env bun
import { program } from "@commander-js/extra-typings";

import { build } from "@/cli/cmd/build";
import { description, version } from "@/package.json";

program.name("sub-store").description(description).version(version).addCommand(build);
await program.parseAsync();
