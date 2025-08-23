import type { Outbound } from "../outbound";
import { Inferrer } from "./abc";
import { InferrerCountry } from "./country";
import { InferrerEmby } from "./emby";
import { InferrerInfo } from "./info";

export class InferrerContainer extends Inferrer {
  public readonly inferrers: Inferrer[];

  public constructor(inferrers?: Inferrer[]) {
    super();
    if (!inferrers) {
      inferrers = [
        new InferrerEmby(),
        new InferrerInfo(),
        new InferrerCountry(), // `InferrerCountry` depends on `InferrerEmby` & `InferrerInfo`
      ];
    }
    this.inferrers = inferrers;
  }

  public override async infer<T extends Outbound>(outbound: T): Promise<T> {
    for (const inferrer of this.inferrers)
      outbound = await inferrer.infer(outbound);
    return outbound;
  }

  public override async inferBulk<T extends Outbound>(
    outbounds: T[],
  ): Promise<T[]> {
    return await Promise.all(
      outbounds.map((outbound: T): Promise<T> => this.infer(outbound)),
    );
  }
}
