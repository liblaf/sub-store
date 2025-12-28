import type { KyInstance } from "ky";
import ky from "ky";

export function defaultClient(): KyInstance {
  return ky.create({
    cf: {
      cacheEverything: true,
      cacheTtl: 1,
      cacheTtlByStatus: { "200": 60 },
    },
    redirect: "follow",
  });
}
