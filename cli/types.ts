import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { StricliAutoCompleteContext } from "@stricli/auto-complete";
import type { CommandContext } from "@stricli/core";

export interface Context extends CommandContext, StricliAutoCompleteContext {
  readonly process: NodeJS.Process;
}

export const context: Context = { process, os, fs, path };
