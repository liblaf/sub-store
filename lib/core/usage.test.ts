import { describe, expect, test } from "bun:test";

import { fetcher } from "../utils";
import { infoProxyNames, usageFromBwcounter, usageFromHeader, usageToHeader } from "./usage";

describe("Subscription-Userinfo", (): void => {
  test("keeps only finite nonnegative recognized fields", (): void => {
    expect(
      usageFromHeader(
        "download=2; upload=1; total=3; expire=4; ignored=5; negative=-1; nan=NaN; bad=1x",
      ),
    ).toEqual({ download: 2, upload: 1, total: 3, expire: 4 });
    expect(usageFromHeader("ignored=1; total=NaN")).toBeUndefined();
  });

  test("serializes headers in protocol order and excludes bwcounter", (): void => {
    expect(usageToHeader({ total: 3, upload: 1, expire: 4 })).toBe("upload=1; total=3; expire=4");
    expect(usageToHeader({ source: "bwcounter", used: 1, total: 3, resetDay: 15 })).toBe("");
  });

  test("formats provider info without turning a bwcounter reset into expiry", (): void => {
    expect(
      infoProxyNames("Counter", new Date("2026-09-01T12:00:00Z"), {
        source: "bwcounter",
        used: 100,
        total: 200,
        resetDay: 15,
      }),
    ).toEqual(["Counter 🔋 100 B / 200 B (50%)", "Counter 🔄 2026-09-01 · resets day 15"]);
  });

  test("omits missing usage fields but always includes the provider update", (): void => {
    expect(
      infoProxyNames("Partial", new Date("2026-09-01T12:00:00Z"), {
        upload: 100,
        total: 200,
      }),
    ).toEqual(["Partial 🔄 2026-09-01"]);
    expect(infoProxyNames("None", new Date("2026-09-01T12:00:00Z"))).toEqual([
      "None 🔄 2026-09-01",
    ]);
  });

  test("formats complete subscription quota and positive expiry", (): void => {
    expect(
      infoProxyNames("Header", new Date("2026-09-01T12:00:00Z"), {
        upload: 20,
        download: 30,
        total: 100,
        expire: Date.parse("2027-01-01T00:00:00Z") / 1000,
      }),
    ).toEqual(["Header 🔋 50.0 B / 100 B (50%)", "Header ⏳ 2027-01-01", "Header 🔄 2026-09-01"]);
    expect(infoProxyNames("Unlimited", new Date("2026-09-01T12:00:00Z"), { expire: 0 })).toEqual([
      "Unlimited 🔄 2026-09-01",
    ]);
  });

  test("keeps bwcounter state separate from subscription header fields", async (): Promise<void> => {
    const originalFetch = fetcher.fetch;
    fetcher.fetch = async (): Promise<Response> =>
      new Response(
        JSON.stringify({
          monthly_bw_limit_b: 200,
          bw_counter_b: 100,
          bw_reset_day_of_month: 15,
        }),
      );
    try {
      await expect(usageFromBwcounter("https://example.test/bw")).resolves.toEqual({
        source: "bwcounter",
        used: 100,
        total: 200,
        resetDay: 15,
      });
    } finally {
      fetcher.fetch = originalFetch;
    }
  });
});
