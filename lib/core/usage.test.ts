import { describe, expect, test } from "bun:test";

import { fetcher } from "../utils";
import { infoProxyNames, usageFromBwcounter, usageFromHeader, usageToHeader } from "./usage";
import type { Usage } from "./usage";

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
    ).toEqual(["[Counter] 📊 100 B / 200 B (50%)", "[Counter] 🔁 15", "[Counter] 📥 2026-09-01"]);
  });

  test("omits missing usage fields but always includes the provider update", (): void => {
    expect(
      infoProxyNames("Partial", new Date("2026-09-01T12:00:00Z"), {
        upload: 100,
        total: 200,
      }),
    ).toEqual(["[Partial] 📥 2026-09-01"]);
    expect(infoProxyNames("None", new Date("2026-09-01T12:00:00Z"))).toEqual([
      "[None] 📥 2026-09-01",
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
    ).toEqual([
      "[Header] 📊 50.0 B / 100 B (50%)",
      "[Header] ⌛ 2027-01-01",
      "[Header] 📥 2026-09-01",
    ]);
    expect(infoProxyNames("Unlimited", new Date("2026-09-01T12:00:00Z"), { expire: 0 })).toEqual([
      "[Unlimited] 📥 2026-09-01",
    ]);
  });

  test.each([
    {
      label: "header at quota",
      usage: { upload: 20, download: 80, total: 100 },
      quota: "0.00 B / 100 B (0%)",
    },
    {
      label: "header over quota",
      usage: { upload: 20, download: 81, total: 100 },
      quota: "-1.00 B / 100 B (-1%)",
    },
    {
      label: "bwcounter at quota",
      usage: { source: "bwcounter", used: 100, total: 100, resetDay: 15 },
      quota: "0.00 B / 100 B (0%)",
    },
    {
      label: "bwcounter over quota",
      usage: { source: "bwcounter", used: 101, total: 100, resetDay: 15 },
      quota: "-1.00 B / 100 B (-1%)",
    },
  ] satisfies { label: string; usage: Usage; quota: string }[])(
    "marks all info nodes for $label",
    ({ usage, quota }): void => {
      const names = infoProxyNames("Exhausted", new Date("2026-09-01T12:00:00Z"), usage);
      expect(names[0]).toBe(`[Exhausted] 🔴 📊 ${quota}`);
      expect(names.every((name) => name.startsWith("[Exhausted] 🔴 "))).toBe(true);
    },
  );

  test.each([
    { upload: 20, download: 79.9, total: 100 },
    { source: "bwcounter", used: 99.9, total: 100, resetDay: 15 },
    { upload: 100, total: 100 },
    { upload: 20, download: 80, total: 0 },
    { expire: 1 },
  ] satisfies Usage[])(
    "does not mark available, unknown, or unlimited quota: %j",
    (usage): void => {
      expect(
        infoProxyNames("Available", new Date("2026-09-01T12:00:00Z"), usage).join(),
      ).not.toContain("🔴");
    },
  );

  test("combines stale and exhausted markers on each existing info node", (): void => {
    expect(
      infoProxyNames(
        "Both",
        new Date("2026-09-01T12:00:00Z"),
        { upload: 20, download: 80, total: 100, expire: 1798761600 },
        true,
      ),
    ).toEqual([
      "[Both] 🔴 ⚠️ 📊 0.00 B / 100 B (0%)",
      "[Both] 🔴 ⚠️ ⌛ 2027-01-01",
      "[Both] 🔴 ⚠️ 📥 2026-09-01",
    ]);
    expect(infoProxyNames("Stale", new Date("2026-09-01T12:00:00Z"), undefined, true)).toEqual([
      "[Stale] ⚠️ 📥 2026-09-01",
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

  test("propagates a configured bwcounter failure", async (): Promise<void> => {
    const originalFetch = fetcher.fetch;
    fetcher.fetch = async (): Promise<Response> => {
      throw new Error("bwcounter unavailable");
    };
    try {
      await expect(usageFromBwcounter("https://example.test/bw")).rejects.toThrow(
        "bwcounter unavailable",
      );
    } finally {
      fetcher.fetch = originalFetch;
    }
  });
});
