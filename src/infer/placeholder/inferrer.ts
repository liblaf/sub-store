import type { Outbound } from "../../outbound";

export class PlaceholderInferrer {
  infer(outbound: Outbound): boolean {
    if (outbound.name.match(/Traffic|剩余流量|距离下次重置剩余|套餐到期/i))
      return true;
    return false;
  }
}
