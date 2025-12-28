import type { Userinfo } from "@shared/schema/userinfo";
import { parseUserinfo } from "@shared/schema/userinfo";
import { defaultClient } from "@shared/utils";
import type { KyInstance, KyResponse } from "ky";
import type { LocalFetchResult } from "../types";

export async function fetchUserinfoDirect(
  url: string | URL,
  client?: KyInstance,
): Promise<LocalFetchResult<Userinfo>> {
  client = client ?? defaultClient();
  const response: KyResponse = await client.head(url, {
    headers: { "User-Agent": "clash.meta" },
  });
  const userinfo: Userinfo = parseUserinfo(
    response.headers.get("Subscription-Userinfo"),
  );
  return { content: userinfo, userinfo };
}
