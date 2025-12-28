import type { OutboundWrapper } from "@core/formats/shared/outbound";

export abstract class Processor {
  async process<O extends OutboundWrapper<T>, T = unknown>(
    outbounds: O[],
  ): Promise<O[]> {
    return await Promise.all(
      outbounds.map(async (o: O): Promise<O> => await this.processSingle(o)),
    );
  }

  processSingle<O extends OutboundWrapper<T>, T = unknown>(
    _outbound: O,
  ): Promise<O> {
    throw new Error("processSingle() Not Implemented");
  }
}
