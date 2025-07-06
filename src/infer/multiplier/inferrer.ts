import type { Outbound } from "../../outbound";

export class MultiplierInferrer {
  infer(outbound: Outbound): number {
    if (outbound.overrides.multiplier !== undefined)
      return outbound.overrides.multiplier;
    const match = outbound.name.match(/(([0-9]*[.])?[0-9]+)x/i);
    if (match) return Number.parseFloat(match[1]!);
    return 1.0;
  }
}
