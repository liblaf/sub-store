export function subconvert(target: string, url: string, base?: string): string {
  base = base ?? process.env.SUBCONVERTER ?? "https://api.ytools.cc";
  const request: URL = new URL("/sub", base);
  request.searchParams.set("target", target);
  request.searchParams.set("url", url);
  request.searchParams.set("list", "true");
  return request.toString();
}
