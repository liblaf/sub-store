import type { Outbound } from "../../outbound";

export class EmbyInferrer {
  infer(outbound: Outbound): boolean {
    return !!outbound.name.match(/emby/i);
  }
}
