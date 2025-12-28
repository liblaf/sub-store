import type { OutboundWrapper } from "@core/formats/shared/outbound";
import consola from "consola";
import { Processor } from "./abc";

export class ProcessorInfo extends Processor {
  pattern: RegExp = /Expire|Traffic|剩余|套餐到期/iu;

  override async processSingle<O extends OutboundWrapper<T>, T = unknown>(
    outbound: O,
  ): Promise<O> {
    outbound.info = this.pattern.test(outbound.name);
    if (outbound.info) consola.success(`${outbound.prettyName} ~ ℹ️ INFO`);
    return outbound;
  }
}
