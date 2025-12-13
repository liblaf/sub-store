const SUBLINK_URL: string =
  process.env.SUBLINK_URL || "https://sublink.liblaf.me/clash";

export function sublinkClashUrl(url: string): URL {
  const req = new URL(SUBLINK_URL);
  req.searchParams.set("config", url);
  req.searchParams.set("ua", "clash.meta");
  return req;
}
