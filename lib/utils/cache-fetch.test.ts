import { describe, expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
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

  test("returns a stale valid cache after a network failure", async (): Promise<void> => {
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
      expect(
        await (await fetcher.fetch("https://example.test/sub", undefined, validateYaml)).text(),
      ).toBe("valid");
    });
  });

  test("rejects a malformed fetched body and retains stale valid cache", async (): Promise<void> => {
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
      body = "malformed";
      expect(
        await (await fetcher.fetch("https://example.test/sub", undefined, validateYaml)).text(),
      ).toBe("valid");
    });
  });

  test("throws when there is no cache to fall back to", async (): Promise<void> => {
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
});
