import type { Outbound } from "../core";

export abstract class Processor {
  async process<O extends Outbound>(outbounds: O[]): Promise<O[]> {
    return await Promise.all(
      outbounds.map(async (o: O): Promise<O> => await this.processOne(o)),
    );
  }

  abstract processOne<T extends Outbound>(outbound: T): Promise<T>;
}
