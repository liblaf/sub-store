import { OutboundWrapper } from "../shared/outbound";
import type { MihomoOutbound } from "./schema";

export class MihomoOutboundWrapper extends OutboundWrapper<MihomoOutbound> {
  override get name(): string {
    return this.wrapped.name;
  }

  override get type(): string {
    return this.wrapped.type;
  }

  override get server(): string {
    return this.wrapped.server;
  }

  override render(): MihomoOutbound {
    return {
      ...this.wrapped,
      name: this.prettyName,
    };
  }
}
