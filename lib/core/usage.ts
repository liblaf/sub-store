import { filesize } from "filesize";

import { fetcher } from "../utils";

export type Bwcounter = {
  monthly_bw_limit_b: number;
  bw_counter_b: number;
  bw_reset_day_of_month: number;
};

export type SubscriptionUserinfo = {
  upload: number;
  download: number;
  total: number;
  expire: number;
};

export type Usage = Partial<Bwcounter> & Partial<SubscriptionUserinfo>;

export async function usageFromBwcounter(url?: string | null): Promise<Usage> {
  if (!url) return {};
  let response: Response;
  try {
    response = await fetcher.fetch(url);
  } catch (err) {
    console.error(err);
    return {};
  }
  return await response.json();
}

export function usageFromHeader(header?: string | null): Usage {
  const usage: Usage = {};
  if (!header) return usage;
  header.split(";").forEach((part: string): void => {
    const [key, value]: string[] = part
      .trim()
      .split("=")
      .map((s: string): string => s.trim());
    if (!(key && value)) return;
    const num: number = Number.parseFloat(value);
    if (Number.isNaN(num)) return;
    usage[key as keyof Usage] = num;
  });
  return usage;
}

export function usageToHeader(usage: Usage): string {
  const subscriptionUserinfo: SubscriptionUserinfo = {
    upload: usage.upload ?? 0,
    download: usage.download ?? usage.bw_counter_b ?? 0,
    total: usage.total ?? usage.monthly_bw_limit_b ?? 0,
    expire: usage.expire ?? 0,
  };
  return Object.entries(subscriptionUserinfo)
    .map(([key, value]: [string, number]): string => `${key}=${value}`)
    .join("; ");
}

export function* usageToProxyNames(usage: Usage): Generator<string> {
  let used: number | undefined;
  if (usage.upload !== undefined && usage.download !== undefined) {
    used = usage.upload + usage.download;
  } else if (usage.bw_counter_b !== undefined) {
    used = usage.bw_counter_b;
  }
  let total: number | undefined = usage.total ?? usage.monthly_bw_limit_b;
  if (used !== undefined) {
    if (total !== undefined) {
      const percentage: number = (used / total) * 100;
      yield `Traffic: ${filesize(used)} / ${filesize(total)} (${percentage.toFixed(0)}%)`;
      yield `Remaining: ${filesize(total - used)} / ${filesize(total)} (${(100 - percentage).toFixed(0)}%)`;
    } else {
      yield `Traffic: ${filesize(used)}`;
    }
  }

  let date: Date | undefined;
  if (usage.expire !== undefined) {
    date = new Date(usage.expire * 1000);
  } else if (usage.bw_reset_day_of_month !== undefined) {
    const now: Date = new Date();
    date = new Date(now.getFullYear(), now.getMonth(), usage.bw_reset_day_of_month);
    if (date < now) date.setMonth(date.getMonth() + 1);
  }
  if (date) yield `Expire: ${date.toLocaleDateString("en-CA")}`; // YYYY-MM-DD
}
