import type { CommandContext } from "@stricli/core";
import { buildCommand } from "@stricli/core";

type Flags = {
  greeting: string;
};

export default buildCommand({
  docs: {
    brief: "Print a friendly, customizable greeting.",
  },
  parameters: {
    flags: {
      greeting: {
        kind: "parsed",
        parse: String,
        brief: "use TEXT as the greeting message",
        default: "Hello, world!",
      },
    },
  },
  async func(this: CommandContext, { greeting }: Flags): Promise<void> {
    console.log(greeting);
  },
});
