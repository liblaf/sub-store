import type { OutboundWrapper } from "@core/formats/shared/outbound";

export type GroupMeta = {
  name: string;
  type: "select" | "url-test";
  emoji?: string;
  icon?: string;
  url?: string;
  "expected-status"?: number;
};

export abstract class Grouper {
  abstract group<T = unknown>(
    outbounds: OutboundWrapper<T>[],
  ): Generator<[GroupMeta, OutboundWrapper<T>[]]>;
}

export abstract class FilterGrouper extends Grouper {
  abstract meta: GroupMeta;

  override *group<T = unknown>(
    outbounds: OutboundWrapper<T>[],
  ): Generator<[GroupMeta, OutboundWrapper<T>[]]> {
    const grouped: OutboundWrapper<T>[] = outbounds.filter(this.filter);
    if (grouped.length > 0) {
      yield [this.meta, grouped];
    }
  }

  abstract filter(outbound: OutboundWrapper): boolean;
}
