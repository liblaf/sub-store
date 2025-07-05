#!/usr/bin/env -S bun
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { StricliAutoCompleteContext } from "@stricli/auto-complete";
import { type CommandContext, run } from "@stricli/core";
import { app } from "../cli/app";

interface Context extends CommandContext, StricliAutoCompleteContext {
  readonly process: NodeJS.Process;
}

const context: Context = { process, os, fs, path };

await run(app, process.argv.slice(2), context);
