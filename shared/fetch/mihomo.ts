import type { Provider } from "@shared/schema/provider";
import { NotFoundException } from "chanfana";
import type { FetchMihomoResult } from "./inner/mihomo";
import { fetchMihomoDirect } from "./inner/mihomo";
import type { Sublink } from "./utils/sublink";

export async function fetchMihomo(
  provider: Provider,
  sublink: Sublink,
): Promise<FetchMihomoResult> {
  if (provider.mihomo) {
    return await fetchMihomoDirect(provider.mihomo);
  }
  const url: string | undefined =
    provider.singbox ?? provider.surge ?? provider.xray;
  if (!url) {
    const { id } = provider;
    throw new NotFoundException(`Provider ${id} does not support mihomo`);
  }
  return await sublink.clash(url);
}
