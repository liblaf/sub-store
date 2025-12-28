import type { Processor } from "./abc";
import { ProcessorCountry } from "./country";
import { ProcessorInfo } from "./info";

export function defaultProcessors(): Processor[] {
  return [new ProcessorInfo(), new ProcessorCountry()];
}
