import type { Userinfo } from "@shared/schema/userinfo";
import { parseUserinfo } from "@shared/schema/userinfo";
import { defaultClient } from "@shared/utils";
import yaml from "js-yaml";
import type { KyInstance, KyResponse } from "ky";
import type { LocalFetchResult } from "../types";

type ClashConfig = {
  proxies: unknown[];
};

export async function fetchMihomoDirect(
  input: string | URL,
  client?: KyInstance,
): Promise<LocalFetchResult<string>> {
  client = client ?? defaultClient();
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
