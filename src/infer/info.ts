import consola from "consola";
import type { Outbound } from "../outbound";
import { Inferrer } from "./abc";

export class InferrerInfo extends Inferrer {
  public readonly pattern: RegExp = /Expire|Traffic|剩余|套餐到期/iu;

  public override async infer<T extends Outbound>(outbound: T): Promise<T> {
    outbound.info = this.pattern.test(outbound.name);
    if (outbound.info) consola.debug(`${outbound.name} ~ ${this.pattern}`);
    return outbound;
  }
}
