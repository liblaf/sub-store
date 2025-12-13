import consola from "consola";
import type { Outbound } from "../core";
import { Processor } from "./base";

export class ProcessorInfo extends Processor {
  public readonly pattern: RegExp = /Expire|Traffic|剩余|套餐到期/iu;

  public override async processOne<O extends Outbound>(
    outbound: O,
  ): Promise<O> {
    outbound.info = this.pattern.test(outbound.name);
    if (outbound.info)
      consola.success(`${outbound.prettyName} ~ ${this.pattern}`);
    return outbound;
  }
}
