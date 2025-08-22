#!/usr/bin/env bun
import { run } from "@stricli/core";
import { app, context } from "../cli";

run(app, process.argv.slice(2), context);
