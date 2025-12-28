import app from "@cli/app";
import { context } from "@cli/types";
import { run } from "@stricli/core";

await run(app, process.argv.slice(2), context);
