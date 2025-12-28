import type { BWCounter } from "@shared/schema/bwcounter";
import type { KyInstance, KyResponse } from "ky";
import ky from "ky";
import type { LocalFetchResult } from "../types";

export async function fetchBWCounterDirect(
  url: string | URL,
  client?: KyInstance,
): Promise<LocalFetchResult<BWCounter>> {
  client = client ?? ky.create({ redirect: "follow" });
  const response: KyResponse = await client.get(url);
  const content: BWCounter = await response.json();
  return {
    content,
    userinfo: {
      download: content.bw_counter_b,
      total: content.monthly_bw_limit_b,
    },
  };
}
