#!/usr/bin/env bun
import { program } from "@commander-js/extra-typings";

import { mihomo } from "@/cli/cmd/mihomo";
import { description, version } from "@/package.json";

program.name("sub-store").description(description).version(version).addCommand(mihomo);
await program.parseAsync();
