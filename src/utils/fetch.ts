import { getLogger } from "./logging";

const logger = getLogger();

export async function fetchUnsafe(
  url: string | URL,
  init?: RequestInit,
): Promise<Response> {
  logger.debug("fetchUnsafe()", { url, init });
  init = init ?? { redirect: "follow" };
  const response: Response = await fetch(url, init);
  if (response.ok) return response;
  throw new Error(`${url} => ${response}`);
}
