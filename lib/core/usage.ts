import consola from "consola";
import { partial } from "filesize";

import { fetcher } from "../utils";

export type Bwcounter = {
  monthly_bw_limit_b: number;
  bw_counter_b: number;
  bw_reset_day_of_month: number;
};

/** Usage fields defined by the Subscription-Userinfo response header. */
export type SubscriptionUserinfo = {
  upload?: number;
  download?: number;
  total?: number;
  expire?: number;
};

/** Monthly quota state returned by a bwcounter endpoint. */
export type BwcounterUsage = {
  source: "bwcounter";
  used: number;
  total: number;
  resetDay: number;
};

export type Usage = SubscriptionUserinfo | BwcounterUsage;

export async function usageFromBwcounter(url?: string | null): Promise<BwcounterUsage | undefined> {
  if (!url) return undefined;
  let response: Response;
  try {
    response = await fetcher.fetch(url, undefined, validateBwcounterResponse);
    const bwcounter: unknown = await response.json();
    if (!isBwcounter(bwcounter)) throw new Error("Invalid bwcounter response");
    return {
      source: "bwcounter",
      used: bwcounter.bw_counter_b,
      total: bwcounter.monthly_bw_limit_b,
      resetDay: bwcounter.bw_reset_day_of_month,
    };
  } catch (err) {
    consola.warn(err);
    return undefined;
  }
}

export function usageFromHeader(header?: string | null): SubscriptionUserinfo | undefined {
  if (!header) return undefined;
  const usage: SubscriptionUserinfo = {};
  const keys = new Set<keyof SubscriptionUserinfo>(["upload", "download", "total", "expire"]);
  for (const part of header.split(";")) {
    const [rawKey, rawValue, ...rest] = part.split("=");
    const key = rawKey?.trim() as keyof SubscriptionUserinfo | undefined;
    const value = rawValue?.trim();
    if (!key || !keys.has(key) || !value || rest.length > 0) continue;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) continue;
    usage[key] = number;
  }
  return Object.keys(usage).length > 0 ? usage : undefined;
}

export function usageToHeader(usage?: Usage | null): string {
  if (!usage || isBwcounterUsage(usage)) return "";
  return (["upload", "download", "total", "expire"] as const)
    .flatMap((key: keyof SubscriptionUserinfo): string[] =>
      usage[key] === undefined ? [] : [`${key}=${usage[key]}`],
    )
    .join("; ");
}

export function infoProxyNames(providerName: string, date: Date, usage?: Usage | null): string[] {
  const names: string[] = [];
  if (isBwcounterUsage(usage)) {
    names.push(quotaToDisplay(usage.used, usage.total));
  } else if (usage) {
    if (
      usage.upload !== undefined &&
      usage.download !== undefined &&
      usage.total !== undefined &&
      usage.total > 0
    ) {
      names.push(quotaToDisplay(usage.upload + usage.download, usage.total));
    }
    if (usage.expire !== undefined && usage.expire > 0) {
      const expire: Date = new Date(usage.expire * 1000);
      // Bunup corrupts a literal U+23F3 in the packaged CLI, so construct it at runtime.
      names.push(`${String.fromCodePoint(0x23f3)} ${formatDate(expire)}`);
    }
  }
  const reset: string = isBwcounterUsage(usage)
    ? ` · ${bwcounterResetToDisplay(usage.resetDay)}`
    : "";
  names.push(`🔄 ${formatDate(date)}${reset}`);
  return names.map((name: string): string => `${providerName} ${name}`);
}

function quotaToDisplay(used: number, total: number): string {
  const filesize = partial({ precision: 3 });
  const remaining: number = total - used;
  const percentage: number = (remaining / total) * 100;
  return `🔋 ${filesize(remaining)} / ${filesize(total)} (${percentage.toFixed(0)}%)`;
}

function bwcounterResetToDisplay(resetDay: number): string {
  return `resets day ${resetDay}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-CA");
}

function isBwcounterUsage(usage?: Usage | null): usage is BwcounterUsage {
  return !!usage && "source" in usage && usage.source === "bwcounter";
}

function isBwcounter(value: unknown): value is Bwcounter {
  if (!value || typeof value !== "object") return false;
  const { monthly_bw_limit_b, bw_counter_b, bw_reset_day_of_month } = value as Bwcounter;
  return (
    Number.isFinite(monthly_bw_limit_b) &&
    monthly_bw_limit_b > 0 &&
    Number.isFinite(bw_counter_b) &&
    bw_counter_b >= 0 &&
    Number.isInteger(bw_reset_day_of_month) &&
    bw_reset_day_of_month >= 1 &&
    bw_reset_day_of_month <= 31
  );
}

async function validateBwcounterResponse(response: Response): Promise<void> {
  if (!isBwcounter(await response.json())) throw new Error("Invalid bwcounter response");
}
