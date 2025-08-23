import consola from "consola";
import type { Outbound } from "../outbound";
import { Inferrer } from "./abc";

export class InferrerEmby extends Inferrer {
  public readonly pattern: RegExp = /emby/i;

  public override async infer<T extends Outbound>(outbound: T): Promise<T> {
    outbound.emby = this.pattern.test(outbound.name);
    if (outbound.emby)
      consola.success(`${outbound.prettyName} ~ ${this.pattern}`);
    return outbound;
  }
}
