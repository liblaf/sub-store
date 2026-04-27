import type { ProxyWrapper } from "@/lib/core/proxy";
import { CCA2_TO_COUNTRY } from "@/lib/pipeline/infer/country";

import { BUILTIN_GROUPS } from "./builtins";
import { groupByCountry, groupFromCca2 } from "./country";
import type { Group } from "./types";

export function group<T>(proxies: ProxyWrapper<T>[], groups: string[]): Group<T>[] {
  return groups.flatMap((name: string): Group<T>[] => {
    const lower: string = name.toLowerCase();
    switch (lower) {
      case "countries":
        return groupByCountry(proxies);
    }
    if (lower in BUILTIN_GROUPS) return [BUILTIN_GROUPS[lower]!(proxies)];
    const upper: string = name.toUpperCase();
    if (upper in CCA2_TO_COUNTRY) return [groupFromCca2(proxies, upper)];
    throw new Error(`Unknown group name: ${name}`);
  });
}
