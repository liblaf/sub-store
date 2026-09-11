import { describe, expect, test } from "bun:test";
import { chmod, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { KyInstance } from "ky";

import { Fetcher, formatUrlForLog } from "./cache-fetch";

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
      expect(await (await fetcher.fetch("https://example.test/sub")).text()).toBe("valid-1");
      expect(await (await fetcher.fetch("https://example.test/sub")).text()).toBe("valid-1");
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

  test("propagates network failures even when a stale cache exists", async (): Promise<void> => {
    await withCache(async (dir: string): Promise<void> => {
      let fail = false;
      const fetcher = new Fetcher(
        kyFrom(async (): Promise<Response> => {
          if (fail) throw new Error("offline");
          return new Response("valid", { headers: { Date: "Thu, 01 Jan 1970 00:00:00 GMT" } });
        }),
        dir,
      );
      await fetcher.fetch("https://example.test/sub", undefined, validateYaml);
      await expireCache(dir);
      fail = true;
      await expect(
        fetcher.fetch("https://example.test/sub", undefined, validateYaml),
      ).rejects.toThrow("offline");
    });
  });

  test("rejects a malformed refresh without overwriting the cache", async (): Promise<void> => {
    await withCache(async (dir: string): Promise<void> => {
      let body = "valid";
      const fetcher = new Fetcher(
        kyFrom(
          async (): Promise<Response> =>
            new Response(body, { headers: { Date: "Thu, 01 Jan 1970 00:00:00 GMT" } }),
        ),
        dir,
      );
      await fetcher.fetch("https://example.test/sub", undefined, validateYaml);
      await expireCache(dir);
      const [file] = await readdir(dir);
      const cacheFile = path.join(dir, file!);
      const before = await readFile(cacheFile, "utf-8");
      body = "malformed";
      await expect(
        fetcher.fetch("https://example.test/sub", undefined, validateYaml),
      ).rejects.toThrow("invalid provider body");
      expect(await readFile(cacheFile, "utf-8")).toBe(before);
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
