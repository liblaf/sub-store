export async function fetchUnsafe(
  url: string | URL,
  init?: RequestInit,
): Promise<Response> {
  init = init ?? { redirect: "follow" };
  const response: Response = await fetch(url, init);
  if (response.ok) return response;
  throw new Error(`${url} => ${response}`);
}
