import { describe, expect, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";
import { chmod, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import ky from "ky";
import type { KyInstance, Options } from "ky";

import { CACHE_TTL_MS, DAY_MS, Fetcher, formatUrlForLog, isStaleResponse } from "./cache-fetch";

type Request = (url: string | URL) => Promise<Response>;

async function withCache(testCase: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "sub-store-cache-"));
  try {
    await testCase(dir);
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
}

function kyFrom(request: Request): KyInstance {
  return request as unknown as KyInstance;
}

const validateYaml = async (response: Response): Promise<void> => {
  if ((await response.text()) !== "valid") throw new Error("invalid provider body");
};

async function expireCache(dir: string): Promise<void> {
  const [file] = await readdir(dir);
  expect(file).toBeDefined();
  const cacheFile = path.join(dir, file!);
  const cached = JSON.parse(await readFile(cacheFile, "utf-8")) as { storedAt: number };
  cached.storedAt = 0;
  await writeFile(cacheFile, JSON.stringify(cached));
}

describe("Fetcher cache", (): void => {
  test.each([
    { headers: { "User-Agent": "clash.meta" }, age: DAY_MS / 2 },
    { headers: { "User-Agent": "clash.meta" }, age: DAY_MS + 1 },
    { headers: [["User-Agent", "clash.meta"]] as [string, string][], age: DAY_MS / 2 },
    { headers: [["User-Agent", "clash.meta"]] as [string, string][], age: DAY_MS + 1 },
  ])("reads safe legacy cache %# without renewing its age or date", async ({ headers, age }) => {
    await withCache(async (dir) => {
      const url = "https://example.test/sub";
      const options: Options = { headers };
      const key = `${createHash("sha256")
        .update(JSON.stringify({ input: url, options }))
        .digest("hex")}.json`;
      const storedAt = Date.now() - age;
      const date = "Mon, 01 Jan 2024 12:00:00 GMT";
      const contents = JSON.stringify({
        body: "valid",
        storedAt,
        init: { headers: { Date: date } },
      });
      await writeFile(path.join(dir, key), contents);
      let calls = 0;
      const fetcher = new Fetcher(
        kyFrom(async () => {
          calls++;
          throw new Error("offline");
        }),
        dir,
        validateYaml,
      );
      const response = await fetcher.fetch(url, options);
      expect(await response.text()).toBe("valid");
      expect(response.headers.get("date")).toBe(date);
      expect(isStaleResponse(response)).toBe(age >= DAY_MS);
      expect(calls).toBe(age >= DAY_MS ? 1 : 0);
      expect(await readFile(path.join(dir, key), "utf-8")).toBe(contents);
      expect(await readdir(dir)).toEqual([key]);
    });
  });

  test("writes and prefers the new key after a successful legacy refresh", async () => {
    await withCache(async (dir) => {
      const url = "https://example.test/sub";
      const options: Options = { headers: { "User-Agent": "clash.meta" } };
      const key = `${createHash("sha256")
        .update(JSON.stringify({ input: url, options }))
        .digest("hex")}.json`;
      const contents = JSON.stringify({
        body: "old",
        storedAt: 0,
        init: { headers: { Date: "Mon, 01 Jan 2024 12:00:00 GMT" } },
      });
      await writeFile(path.join(dir, key), contents);
      let calls = 0;
      const fetcher = new Fetcher(
        kyFrom(async () => {
          calls++;
          return new Response("new");
        }),
        dir,
      );
      expect(await (await fetcher.fetch(url, options)).text()).toBe("new");
      expect(await readFile(path.join(dir, key), "utf-8")).toBe(contents);
      expect(await readdir(dir)).toHaveLength(2);
      expect(await (await fetcher.fetch(url, options)).text()).toBe("new");
      expect(calls).toBe(1);
    });
  });

  test("never reuses legacy Headers entries whose credentials were lost from the key", async () => {
    await withCache(async (dir) => {
      const url = "https://example.test/sub";
      // Model runtimes where Headers has no enumerable serialized header fields.
      class LegacyHeaders extends Headers {
        override toJSON(): Record<string, never> {
          return {};
        }
      }
      const first: Options = { headers: new LegacyHeaders({ Authorization: "first-secret" }) };
      const second: Options = { headers: new LegacyHeaders({ Authorization: "second-secret" }) };
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      const key = `${createHash("sha256")
        .update(JSON.stringify({ input: url, options: first }))
        .digest("hex")}.json`;
      const contents = JSON.stringify({ body: "valid", storedAt: Date.now(), init: {} });
      await writeFile(path.join(dir, key), contents);
      let calls = 0;
      const fetcher = new Fetcher(
        kyFrom(async () => {
          calls++;
          throw new Error("offline");
        }),
        dir,
        validateYaml,
      );
      await expect(fetcher.fetch(url, second)).rejects.toThrow("offline");
      expect(calls).toBe(1);
      expect(await readFile(path.join(dir, key), "utf-8")).toBe(contents);
    });
  });

  test("creates private cache files and repairs permissive existing ones", async (): Promise<void> => {
    await withCache(async (dir: string): Promise<void> => {
      const cacheDir = path.join(dir, "cache");
      const fetcher = new Fetcher(
        kyFrom(async (): Promise<Response> => new Response("valid")),
        cacheDir,
      );
      await fetcher.fetch("https://example.test/sub");
      const [file] = await readdir(cacheDir);
      expect(file).toBeDefined();
      expect((await stat(cacheDir)).mode & 0o777).toBe(0o700);
      expect((await stat(path.join(cacheDir, file!))).mode & 0o777).toBe(0o600);
      await chmod(cacheDir, 0o755);
      await chmod(path.join(cacheDir, file!), 0o644);

      await fetcher.fetch("https://example.test/sub");

      expect((await stat(cacheDir)).mode & 0o777).toBe(0o755);
      expect((await stat(path.join(cacheDir, file!))).mode & 0o777).toBe(0o600);
    });
  });

  test("refuses to read or overwrite a cache symlink target", async (): Promise<void> => {
    await withCache(async (dir: string): Promise<void> => {
      const cacheDir = path.join(dir, "cache");
      const fetcher = new Fetcher(
        kyFrom(async (): Promise<Response> => new Response("valid")),
        cacheDir,
      );
      await fetcher.fetch("https://example.test/sub");
      const [file] = await readdir(cacheDir);
      expect(file).toBeDefined();
      const cacheFile = path.join(cacheDir, file!);
      const victim = path.join(dir, "victim");
      await writeFile(victim, "unchanged", { mode: 0o644 });
      await rm(cacheFile);
      await symlink(victim, cacheFile);

      await expect(fetcher.fetch("https://example.test/sub")).rejects.toThrow();

      expect(await readFile(victim, "utf-8")).toBe("unchanged");
      expect((await stat(victim)).mode & 0o777).toBe(0o644);
    });
  });

  test("redacts credentials, paths, and queries from log labels", (): void => {
    expect(
      formatUrlForLog("https://username:password@example.test/private/token?secret=value"),
    ).toBe("https://example.test");
  });

  test("uses a fresh cached response even when upstream Date is old", async (): Promise<void> => {
    await withCache(async (dir: string): Promise<void> => {
      let calls = 0;
      const fetcher = new Fetcher(
        kyFrom(
          async (): Promise<Response> =>
            new Response(`valid-${++calls}`, {
              headers: { Date: "Thu, 01 Jan 1970 00:00:00 GMT" },
            }),
        ),
        dir,
      );
      const original = await fetcher.fetch("https://example.test/sub");
      const cached = await fetcher.fetch("https://example.test/sub");
      expect(await original.text()).toBe("valid-1");
      expect(await cached.text()).toBe("valid-1");
      expect(isStaleResponse(original)).toBe(false);
      expect(isStaleResponse(cached)).toBe(false);
      expect(calls).toBe(1);
    });
  });

  test("replaces a malformed upstream Date with a valid fetch time", async (): Promise<void> => {
    await withCache(async (dir: string): Promise<void> => {
      const fetcher = new Fetcher(
        kyFrom(
          async (): Promise<Response> => new Response("valid", { headers: { Date: "not-a-date" } }),
        ),
        dir,
      );

      const response = await fetcher.fetch("https://example.test/sub");

      expect(Number.isFinite(Date.parse(response.headers.get("Date")!))).toBe(true);
    });
  });

  test.each(["network", "HTTP"] as const)(
    "reuses stale cache after a %s failure without updating its date or age",
    async (failure): Promise<void> => {
      await withCache(async (dir: string): Promise<void> => {
        const upstream = { fail: false };
        let calls = 0;
        const date = "Mon, 01 Jan 2024 12:00:00 GMT";
        const userinfo = "upload=1; download=2; total=100";
        const fetcher = new Fetcher(
          ky.create({
            retry: 0,
            fetch: async (): Promise<Response> => {
              calls++;
              if (upstream.fail) {
                if (failure === "network") throw new TypeError("offline");
                return new Response("unavailable", { status: 503 });
              }
              return new Response("valid", {
                headers: { Date: date, "Subscription-Userinfo": userinfo },
              });
            },
          }),
          dir,
        );
        await fetcher.fetch("https://example.test/sub", undefined, validateYaml);
        await expireCache(dir);
        const [file] = await readdir(dir);
        const cacheFile = path.join(dir, file!);
        const before = await readFile(cacheFile, "utf-8");
        upstream.fail = true;

        for (let attempt = 0; attempt < 2; attempt++) {
          const response = await fetcher.fetch("https://example.test/sub", undefined, validateYaml);

          expect(isStaleResponse(response)).toBe(true);
          expect(await response.text()).toBe("valid");
          expect(response.headers.get("date")).toBe(date);
          expect(response.headers.get("subscription-userinfo")).toBe(userinfo);
          expect(await readFile(cacheFile, "utf-8")).toBe(before);
        }
        expect(calls).toBe(3);

        upstream.fail = false;
        const refreshed = await fetcher.fetch("https://example.test/sub", undefined, validateYaml);
        expect(isStaleResponse(refreshed)).toBe(false);
        expect(await readFile(cacheFile, "utf-8")).not.toBe(before);
        const cached = await fetcher.fetch("https://example.test/sub", undefined, validateYaml);
        expect(isStaleResponse(cached)).toBe(false);
        expect(calls).toBe(4);
      });
    },
  );

  test("preserves the original fetch date when stale upstream data had no Date header", async (): Promise<void> => {
    await withCache(async (dir: string): Promise<void> => {
      const upstream = { fail: false };
      const fetcher = new Fetcher(
        kyFrom(async (): Promise<Response> => {
          if (upstream.fail) throw new Error("offline");
          return new Response("valid");
        }),
        dir,
      );
      const original = await fetcher.fetch("https://example.test/sub");
      await expireCache(dir);
      upstream.fail = true;

      const response = await fetcher.fetch("https://example.test/sub");

      expect(response.headers.get("date")).toBe(original.headers.get("date"));
      expect(await response.text()).toBe("valid");
    });
  });

  test("rejects an invalid stale cache when upstream fails", async (): Promise<void> => {
    await withCache(async (dir: string): Promise<void> => {
      const upstream = { fail: false };
      const fetcher = new Fetcher(
        kyFrom(async (): Promise<Response> => {
          if (upstream.fail) throw new Error("offline");
          return new Response("malformed");
        }),
        dir,
      );
      await fetcher.fetch("https://example.test/sub");
      await expireCache(dir);
      upstream.fail = true;

      await expect(
        fetcher.fetch("https://example.test/sub", undefined, validateYaml),
      ).rejects.toThrow("invalid provider body");
    });
  });

  test("reuses valid stale data after a malformed refresh without overwriting the cache", async (): Promise<void> => {
    await withCache(async (dir: string): Promise<void> => {
      const upstream = { body: "valid" };
      const fetcher = new Fetcher(
        kyFrom(
          async (): Promise<Response> =>
            new Response(upstream.body, { headers: { Date: "Thu, 01 Jan 1970 00:00:00 GMT" } }),
        ),
        dir,
      );
      await fetcher.fetch("https://example.test/sub", undefined, validateYaml);
      await expireCache(dir);
      const [file] = await readdir(dir);
      const cacheFile = path.join(dir, file!);
      const before = await readFile(cacheFile, "utf-8");
      upstream.body = "malformed";
      const response = await fetcher.fetch("https://example.test/sub", undefined, validateYaml);
      expect(isStaleResponse(response)).toBe(true);
      expect(await response.text()).toBe("valid");
      expect(await readFile(cacheFile, "utf-8")).toBe(before);
    });
  });

  test("keeps entries for 24 hours and refreshes at the exact boundary", async (): Promise<void> => {
    await withCache(async (dir): Promise<void> => {
      expect(CACHE_TTL_MS).toBe(DAY_MS);
      let calls = 0;
      let now = 1_800_000_000_000;
      const clock = spyOn(Date, "now").mockImplementation(() => now);
      try {
        const fetcher = new Fetcher(
          kyFrom(async () => new Response(String(++calls))),
          dir,
        );
        await fetcher.fetch("https://example.test/sub");
        now += DAY_MS - 1;
        expect(await (await fetcher.fetch("https://example.test/sub")).text()).toBe("1");
        now++;
        expect(await (await fetcher.fetch("https://example.test/sub")).text()).toBe("2");
        expect(calls).toBe(2);
      } finally {
        clock.mockRestore();
      }
    });
  });

  test("deduplicates concurrent requests and gives callers independent response bodies", async (): Promise<void> => {
    await withCache(async (dir): Promise<void> => {
      let calls = 0;
      const fetcher = new Fetcher(
        kyFrom(async () => {
          calls++;
          return new Response("valid");
        }),
        dir,
        validateYaml,
      );
      const responses = await Promise.all(
        Array.from({ length: 8 }, () => fetcher.fetch("https://example.test/sub")),
      );
      expect(calls).toBe(1);
      expect(await Promise.all(responses.map((response) => response.text()))).toEqual(
        Array(8).fill("valid"),
      );
      await expireCache(dir);
      const failing = new Fetcher(
        kyFrom(async () => {
          calls++;
          throw new Error("offline");
        }),
        dir,
        validateYaml,
      );
      const stale = await Promise.all([
        failing.fetch("https://example.test/sub"),
        failing.fetch("https://example.test/sub"),
      ]);
      expect(calls).toBe(2);
      expect(stale.every(isStaleResponse)).toBe(true);
      expect(await Promise.all(stale.map((response) => response.text()))).toEqual([
        "valid",
        "valid",
      ]);
    });
  });

  test("keeps Header objects with different credentials in separate cache entries", async (): Promise<void> => {
    await withCache(async (dir): Promise<void> => {
      let calls = 0;
      const fetcher = new Fetcher(
        kyFrom(async () => new Response(String(++calls))),
        dir,
      );
      const first = await fetcher.fetch("https://example.test/sub", {
        headers: new Headers({ Authorization: "first" }),
      });
      const second = await fetcher.fetch("https://example.test/sub", {
        headers: new Headers({ Authorization: "second" }),
      });
      expect(await first.text()).toBe("1");
      expect(await second.text()).toBe("2");
    });
  });

  test("propagates network failures without a cache", async (): Promise<void> => {
    await withCache(async (dir: string): Promise<void> => {
      const fetcher = new Fetcher(
        kyFrom(async (): Promise<Response> => {
          throw new Error("offline");
        }),
        dir,
      );
      await expect(fetcher.fetch("https://example.test/sub")).rejects.toThrow("offline");
    });
  });

  test("rejects an invalid fresh cache without hiding it with a refetch", async (): Promise<void> => {
    await withCache(async (dir: string): Promise<void> => {
      let calls = 0;
      const fetcher = new Fetcher(
        kyFrom(async (): Promise<Response> => {
          calls++;
          return new Response("malformed");
        }),
        dir,
      );
      await fetcher.fetch("https://example.test/sub");

      await expect(
        fetcher.fetch("https://example.test/sub", undefined, validateYaml),
      ).rejects.toThrow("invalid provider body");
      expect(calls).toBe(1);
    });
  });
});
