import { z } from "zod/v3";

export const USERINFO_SCHEMA = z
  .object({
    upload: z.number().optional(),
    download: z.number().optional(),
    total: z.number().optional(),
    expire: z.number().optional(),
  })
  .catchall(z.string());
export type Userinfo = z.infer<typeof USERINFO_SCHEMA>;

export function parseUserinfo(header: string | null): Userinfo {
  const userinfo: Userinfo = {};
  if (!header) return userinfo;
  for (const part of header.split(";")) {
    let [key, value] = part.split("=");
    if (!key || !value) continue;
    key = key.trim();
    value = value.trim();
    if (!key || !value) continue;
    if (
      key === "upload" ||
      key === "download" ||
      key === "total" ||
      key === "expire"
    ) {
      userinfo[key] = +value;
    } else {
      userinfo[key] = value;
    }
  }
  return userinfo;
}

export function serializeUserinfo(userinfo: Userinfo): string {
  return Object.entries(userinfo)
    .map(([key, value]: [string, number | string]): string => `${key}=${value}`)
    .join("; ");
}
