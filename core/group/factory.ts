import type { Grouper } from "./abc";
import { Ai, Auto, Binance, Download, Info, Stream } from "./common";
import { CountryGrouper } from "./country";

export function defaultGroupers(): Grouper[] {
  return [
    new Auto(),
    new Ai(),
    new Binance(),
    new Download(),
    new Info(),
    new Stream(),
    new CountryGrouper(),
  ];
}
