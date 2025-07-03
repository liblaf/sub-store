export async function fetchUnsafe(url: string, ua?: string): Promise<Response> {
  const headers = new Headers();
  if (ua) headers.set("User-Agent", ua);
  const response: Response = await fetch(url, { headers, redirect: "follow" });
  if (response.ok) return response;
  throw new Error(`${url} => ${response}`);
}
