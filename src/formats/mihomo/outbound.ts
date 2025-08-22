import { Outbound } from "../../outbound";
import type { Provider } from "../../provider";
import type { MihomoNode, MihomoNodeOptions } from "./schema";
import { MIHOMO_NODE_SCHEMA } from "./schema";

export class MihomoOutbound extends Outbound {
  private readonly raw: MihomoNode;

  public constructor(raw: MihomoNodeOptions, provider: Provider) {
    super(provider);
    this.raw = MIHOMO_NODE_SCHEMA.parse(raw);
  }

  public override get name(): string {
    return this.raw.name;
  }

  public override get type(): string {
    return this.raw.type;
  }

  public override get server(): string {
    return this.raw.server;
  }

  public get mihomo(): MihomoNode {
    return { ...this.raw, name: this.prettyName };
  }
}
