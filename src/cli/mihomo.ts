import { buildCommand, type CommandContext } from "@stricli/core";
import type { Logger } from "tslog";
import { getLogger } from "../utils";

type Flags = {
  output: string;
};

export const mihomo = buildCommand({
  docs: {
    brief: "mihomo",
  },
  async func(this: CommandContext, flags: Flags): Promise<void> {
    const logger: Logger<undefined> = getLogger();
    logger.debug(flags);
  },
  parameters: {
    flags: {
      output: {
        kind: "parsed",
        parse: String,
        brief: "output",
        default: "config.yaml",
      },
    },
  },
});
