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

export function* usageToProxyNames(_usage: Usage): Generator<string> {
  yield "";
  throw new Error("not implemented");
}
