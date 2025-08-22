import ky from "ky";

const BACKEND: string = process.env.SUBCONVERTER_URL || "https://url.v1.mk/sub";

export function subconvertUrl(url: string, target: string): URL {
  const req = new URL(BACKEND);
  req.searchParams.set("url", url);
  req.searchParams.set("target", target);
  req.searchParams.set("list", "true");
  return req;
}

export async function subconvert(url: string, target: string): Promise<string> {
  const req: URL = subconvertUrl(url, target);
  return await ky.get(req).text();
}
