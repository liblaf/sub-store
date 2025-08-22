import type { Outbound } from "../outbound";

export abstract class Inferrer {
  public abstract infer<T extends Outbound>(outbound: T): Promise<T>;

  public async inferBulk<T extends Outbound>(outbounds: T[]): Promise<T[]> {
    return await Promise.all(
      outbounds.map((outbound: T): Promise<T> => this.infer(outbound)),
    );
  }
}
