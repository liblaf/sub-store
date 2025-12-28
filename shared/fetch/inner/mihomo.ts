import type { Userinfo } from "@shared/schema/userinfo";
import { parseUserinfo } from "@shared/schema/userinfo";
import yaml from "js-yaml";
import type { KyInstance, KyResponse } from "ky";
import ky from "ky";

type ClashConfig = {
  proxies: unknown[];
};

export type FetchMihomoResult = {
  content: string;
  userinfo: Userinfo;
};

export async function fetchMihomoDirect(
  input: string | URL,
  client?: KyInstance,
): Promise<FetchMihomoResult> {
  client = client ?? ky.create({ redirect: "follow" });
  const response: KyResponse = await client.get(input, {
    headers: { "User-Agent": "clash.meta" },
  });
  const content: string = await response.text();
  const config = yaml.load(content) as ClashConfig;
  if (!config.proxies) {
    throw new Error("empty subscription");
  }
  const userinfo: Userinfo = parseUserinfo(
    response.headers.get("Subscription-Userinfo"),
  );
  return { content, userinfo };
}
