import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import ky from "ky";
import YAML from "yaml";

import { MihomoBuilder } from "@/lib/formats/mihomo/builder";
import { StashBuilder } from "@/lib/formats/stash/builder";
import { publishProfiles } from "@/lib/publish";
import { fetcher } from "@/lib/utils";
import { Fetcher } from "@/lib/utils/cache-fetch";

const artifact = (
  body: string,
  header = "value",
): { body: string; metadata: { headers: Record<string, string> } } => ({
  body,
  metadata: { headers: { "Subscription-Userinfo": header } },
});

const profile = (id: string, providers: unknown[] = []): string =>
  YAML.stringify({
    id,
    vars: { TS_AUTH_KEY: "test-auth-key" },
    providers,
  });

const temporaryDirectories: string[] = [];
const makeDirectory = async (): Promise<string> => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sub-store-publish-test-"));
  temporaryDirectories.push(directory);
  return directory;
};

afterEach(async (): Promise<void> => {
  mock.restore();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true })),
  );
});

function stubBuilders(): void {
  spyOn(MihomoBuilder.prototype, "build").mockResolvedValue(artifact("mihomo"));
  spyOn(StashBuilder.prototype, "build").mockResolvedValue(artifact("stash"));
}

function mockFetch(
  handler: (...args: Parameters<typeof fetch>) => Promise<Response>,
): ReturnType<typeof spyOn> {
  const implementation = Object.assign(handler, { preconnect: fetch.preconnect });
  return spyOn(globalThis, "fetch").mockImplementation(implementation);
}

describe("publishProfiles", () => {
  test("publishes one profile file with both artifacts and authorization", async () => {
    const directory = await makeDirectory();
    const file = path.join(directory, "profile.yaml");
    await fs.writeFile(file, profile("0123456789ABCDEFGHJK"));
    stubBuilders();
    const requests: Request[] = [];
    mockFetch(async (input, init) => {
      requests.push(new Request(input, init));
      return new Response(null, { status: 204 });
    });

    await expect(
      publishProfiles(file, { url: "https://example.test/", token: "secret" }),
    ).resolves.toBe(1);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(
      "https://example.test/api/profiles/0123456789ABCDEFGHJK/artifacts",
    );
    expect(requests[0]?.method).toBe("PUT");
    expect(requests[0]?.headers.get("authorization")).toBe("Bearer secret");
    expect(requests[0]?.headers.get("content-type")).toBe("application/json");
    expect((await requests[0]!.json()) as Record<string, unknown>).toEqual({
      mihomo: artifact("mihomo"),
      stash: artifact("stash"),
    });
  });

  test("sorts directory YAML files, ignores dotfiles and non-YAML files, and handles spaces", async () => {
    const directory = await makeDirectory();
    await fs.writeFile(path.join(directory, "z profile.yaml"), profile("0123456789ABCDEFGHJK"));
    await fs.writeFile(path.join(directory, "a profile.yaml"), profile("0123456789ABCDEFGHJM"));
    await fs.writeFile(path.join(directory, ".hidden.yaml"), profile("0123456789ABCDEFGHJM"));
    await fs.writeFile(path.join(directory, "ignored.txt"), profile("0123456789ABCDEFGHJN"));
    stubBuilders();
    const urls: string[] = [];
    mockFetch(async (input) => {
      urls.push(String(input));
      return new Response(null, { status: 204 });
    });

    await expect(
      publishProfiles(directory, { url: "https://example.test", token: "token" }),
    ).resolves.toBe(2);
    expect(urls).toEqual([
      "https://example.test/api/profiles/0123456789ABCDEFGHJM/artifacts",
      "https://example.test/api/profiles/0123456789ABCDEFGHJK/artifacts",
    ]);
  });

  test("rejects empty directories and malformed or duplicate profiles before upload", async () => {
    const empty = await makeDirectory();
    const emptyFetch = spyOn(globalThis, "fetch");
    await expect(
      publishProfiles(empty, { url: "https://example.test", token: "token" }),
    ).rejects.toThrow();
    expect(emptyFetch).not.toHaveBeenCalled();

    const directory = await makeDirectory();
    await fs.writeFile(path.join(directory, "bad.yaml"), "id: bad\nproviders: []\n");
    const invalidFetch = spyOn(globalThis, "fetch");
    await expect(
      publishProfiles(directory, { url: "https://example.test", token: "token" }),
    ).rejects.toThrow();
    expect(invalidFetch).not.toHaveBeenCalled();
    await fs.rm(path.join(directory, "bad.yaml"));
    await fs.writeFile(path.join(directory, "one.yaml"), profile("0123456789ABCDEFGHJK"));
    await fs.writeFile(path.join(directory, "two.yaml"), profile("0123456789ABCDEFGHJK"));
    const duplicateFetch = spyOn(globalThis, "fetch");
    await expect(
      publishProfiles(directory, { url: "https://example.test", token: "token" }),
    ).rejects.toThrow();
    expect(duplicateFetch).not.toHaveBeenCalled();
  });

  test("does not upload if a later build fails", async () => {
    const directory = await makeDirectory();
    await fs.writeFile(path.join(directory, "one.yaml"), profile("0123456789ABCDEFGHJK"));
    await fs.writeFile(path.join(directory, "two.yaml"), profile("0123456789ABCDEFGHJM"));
    spyOn(MihomoBuilder.prototype, "build")
      .mockResolvedValueOnce(artifact("one"))
      .mockRejectedValueOnce(new Error("build failed"));
    spyOn(StashBuilder.prototype, "build").mockResolvedValue(artifact("stash"));
    const fetch = spyOn(globalThis, "fetch");
    await expect(
      publishProfiles(directory, { url: "https://example.test", token: "token" }),
    ).rejects.toThrow("build failed");
    expect(fetch).not.toHaveBeenCalled();
  });

  test("publishes stale provider artifacts when the expired upstream cache cannot refresh", async () => {
    const directory = await makeDirectory();
    const cacheDirectory = path.join(directory, "cache");
    const upstream = "https://subscription.example.test/profile";
    const oldDate = "Thu, 29 Feb 2024 12:00:00 GMT";
    await fs.writeFile(
      path.join(directory, "profile.yaml"),
      profile("0123456789ABCDEFGHJK", [{ name: "Cached", mihomo: upstream }]),
    );

    let upstreamAvailable = true;
    let upstreamRequests = 0;
    const cachedFetcher = new Fetcher(
      ky.create({
        retry: 0,
        fetch: async (): Promise<Response> => {
          upstreamRequests += 1;
          if (!upstreamAvailable) throw new TypeError("offline");
          return new Response(
            YAML.stringify({ proxies: [{ name: "Cached proxy", type: "direct" }] }),
            { headers: { Date: oldDate } },
          );
        },
      }),
      cacheDirectory,
    );
    spyOn(fetcher, "fetch").mockImplementation(cachedFetcher.fetch.bind(cachedFetcher));
    await fetcher.fetch(upstream, { headers: { "User-Agent": "clash.meta" } });
    const [cacheFile] = await fs.readdir(cacheDirectory);
    expect(cacheFile).toBeDefined();
    const cachePath = path.join(cacheDirectory, cacheFile!);
    const cached = JSON.parse(await fs.readFile(cachePath, "utf-8")) as { storedAt: number };
    cached.storedAt = 0;
    await fs.writeFile(cachePath, JSON.stringify(cached));
    const cacheBeforePublish = await fs.readFile(cachePath, "utf-8");
    upstreamAvailable = false;

    spyOn(MihomoBuilder.prototype, "render").mockImplementation(
      async (_proxies, infoProxies): Promise<string> =>
        infoProxies.map(({ name }) => name).join("\n"),
    );
    spyOn(StashBuilder.prototype, "render").mockImplementation(
      async (_proxies, infoProxies): Promise<string> =>
        infoProxies.map(({ name }) => name).join("\n"),
    );
    const uploads: Record<string, unknown>[] = [];
    mockFetch(async (input, init) => {
      const request = new Request(input, init);
      uploads.push((await request.json()) as Record<string, unknown>);
      return new Response(null, { status: 204 });
    });

    await expect(
      publishProfiles(directory, { url: "https://example.test", token: "token" }),
    ).resolves.toBe(1);

    expect(upstreamRequests).toBe(3);
    expect(uploads).toHaveLength(1);
    const artifacts = uploads[0]!;
    for (const format of ["mihomo", "stash"]) {
      expect((artifacts[format] as { body: string }).body).toContain("[Cached] 📥 2024-02-29");
    }
    expect(await fs.readFile(cachePath, "utf-8")).toBe(cacheBeforePublish);
  });

  test("propagates HTTP failure without uploading another profile", async () => {
    const directory = await makeDirectory();
    await fs.writeFile(path.join(directory, "one.yaml"), profile("0123456789ABCDEFGHJK"));
    await fs.writeFile(path.join(directory, "two.yaml"), profile("0123456789ABCDEFGHJM"));
    stubBuilders();
    let calls = 0;
    mockFetch(async () => {
      calls += 1;
      return new Response("private server response", { status: 500 });
    });
    await expect(
      publishProfiles(directory, { url: "https://example.test", token: "token" }),
    ).rejects.toThrow("Artifact upload failed (HTTP 500)");
    expect(calls).toBe(1);
  });

  test("uses redirect error mode", async () => {
    const directory = await makeDirectory();
    await fs.writeFile(path.join(directory, "one.yaml"), profile("0123456789ABCDEFGHJK"));
    stubBuilders();
    let requestInit: RequestInit | undefined;
    mockFetch(async (_input, init) => {
      requestInit = init;
      return new Response(null, { status: 204 });
    });
    await publishProfiles(directory, { url: "https://example.test", token: "token" });
    expect(requestInit?.redirect).toBe("error");
  });

  test("rejects missing token and insecure non-local URLs before upload", async () => {
    const directory = await makeDirectory();
    await fs.writeFile(path.join(directory, "one.yaml"), profile("0123456789ABCDEFGHJK"));
    const fetch = spyOn(globalThis, "fetch");
    await expect(
      publishProfiles(directory, { url: "http://example.test", token: "token" }),
    ).rejects.toThrow();
    await expect(
      publishProfiles(directory, { url: "https://example.test", token: " " }),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  test("rejects oversized artifacts before upload", async () => {
    const directory = await makeDirectory();
    await fs.writeFile(path.join(directory, "one.yaml"), profile("0123456789ABCDEFGHJK"));
    spyOn(MihomoBuilder.prototype, "build").mockResolvedValue(
      artifact("x".repeat(11 * 1024 * 1024)),
    );
    spyOn(StashBuilder.prototype, "build").mockResolvedValue(artifact("stash"));
    const fetch = spyOn(globalThis, "fetch");
    await expect(
      publishProfiles(directory, { url: "https://example.test", token: "token" }),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
