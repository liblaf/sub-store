import consola from "consola";
import { filesize } from "filesize";

import { fetcher } from "../utils";

export type Bwcounter = {
  monthly_bw_limit_b: number;
  bw_counter_b: number;
  bw_reset_day_of_month: number;
};

export type SubscriptionUserinfo = {
  upload?: number;
  download?: number;
  total?: number;
  expire?: number;
};

export async function usageFromBwcounter(
  url?: string | null,
): Promise<SubscriptionUserinfo | undefined> {
  if (!url) return undefined;
  let response: Response;
  try {
    response = await fetcher.fetch(url);
  } catch (err) {
    consola.error(err);
    return undefined;
  }
  const bwcounter: Bwcounter = await response.json();
  const now: Date = new Date();
  const expire: Date = new Date(now.getFullYear(), now.getMonth(), bwcounter.bw_reset_day_of_month);
  if (expire < now) expire.setMonth(expire.getMonth() + 1);
  return {
    download: bwcounter.bw_counter_b,
    total: bwcounter.monthly_bw_limit_b,
    expire: expire.getTime() / 1000,
  };
}

export function usageFromHeader(header?: string | null): SubscriptionUserinfo | undefined {
  if (!header) return undefined;
  const obj = Object.fromEntries(
    header
      .split(";")
      .map((s: string): string => s.trim())
      .filter(Boolean)
      .map((s: string): [string, string] => {
        const [key, value] = s.split("=");
        return [key!.trim(), value!.trim()];
      })
      .filter(([key, value]: [string, string]): boolean => !!(key && value))
      .map(([key, value]: [string, string]): [string, number] => {
        return [key, Number.parseFloat(value)];
      }),
  ) as SubscriptionUserinfo;
  return obj;
}

export function usageToHeader(usage?: SubscriptionUserinfo | null): string {
  if (!usage) return "";
  return Object.entries(usage)
    .map(([key, value]: [string, number]): string => `${key}=${value}`)
    .join("; ");
}

export function* usageToProxyNames(usage?: SubscriptionUserinfo | null): Generator<string> {
  if (!usage) return;
  if (usage.total) {
    const { upload, download, total } = usage;
    const used: number = (upload ?? 0) + (download ?? 0);
    const percentage: number = (used / total) * 100;
    yield `Traffic: ${filesize(used)} / ${filesize(total)} (${percentage.toFixed(0)}%)`;
    yield `Remaining: ${filesize(total - used)} / ${filesize(total)} (${(100 - percentage).toFixed(0)}%)`;
  }
  if (usage.expire) {
    let expire: Date = new Date(usage.expire * 1000);
    yield `Expire: ${expire.toLocaleDateString("en-CA")}`; // YYYY-MM-DD
  }
}
