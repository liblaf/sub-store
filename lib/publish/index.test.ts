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

const profile = (
  id: string,
  target: "mihomo" | "stash" = "mihomo",
  providers: Record<string, unknown> = {},
): string =>
  YAML.stringify({
    "__sub-store": { id, target },
    proxies: [],
    "proxy-groups": [],
    "proxy-providers": providers,
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
  test("publishes only the declared target with authorization", async () => {
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
    });
  });

  test("groups distinct targets for one ID into one upload", async () => {
    const directory = await makeDirectory();
    const id = "0123456789ABCDEFGHJK";
    await fs.writeFile(path.join(directory, "mihomo.yaml"), profile(id));
    await fs.writeFile(path.join(directory, "stash.yaml"), profile(id, "stash"));
    const mihomo = spyOn(MihomoBuilder.prototype, "build").mockResolvedValue(artifact("mihomo"));
    const stash = spyOn(StashBuilder.prototype, "build").mockResolvedValue(artifact("stash"));
    const requests: Request[] = [];
    mockFetch(async (input, init) => {
      requests.push(new Request(input, init));
      return new Response(null, { status: 204 });
    });
    await expect(
      publishProfiles(directory, { url: "https://example.test", token: "token" }),
    ).resolves.toBe(1);
    expect(mihomo).toHaveBeenCalledTimes(1);
    expect(stash).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(1);
    expect((await requests[0]!.json()) as Record<string, unknown>).toEqual({
      mihomo: artifact("mihomo"),
      stash: artifact("stash"),
    });
  });

  test("builds a Stash profile without running Mihomo", async () => {
    const directory = await makeDirectory();
    const file = path.join(directory, "stash.yaml");
    await fs.writeFile(file, profile("0123456789ABCDEFGHJK", "stash"));
    const mihomo = spyOn(MihomoBuilder.prototype, "build").mockRejectedValue(
      new Error("must not run"),
    );
    spyOn(StashBuilder.prototype, "build").mockResolvedValue(artifact("stash"));
    const requests: Request[] = [];
    mockFetch(async (input, init) => {
      requests.push(new Request(input, init));
      return new Response(null, { status: 204 });
    });
    await publishProfiles(file, { url: "https://example.test", token: "token" });
    expect(mihomo).not.toHaveBeenCalled();
    expect((await requests[0]!.json()) as Record<string, unknown>).toEqual({
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
    const duplicateBuild = spyOn(MihomoBuilder.prototype, "build");
    await expect(
      publishProfiles(directory, { url: "https://example.test", token: "token" }),
    ).rejects.toThrow();
    expect(duplicateFetch).not.toHaveBeenCalled();
    expect(duplicateBuild).not.toHaveBeenCalled();
  });

  test("requires publishing metadata before any build", async () => {
    const directory = await makeDirectory();
    const file = path.join(directory, "profile.yaml");
    const builder = spyOn(StashBuilder.prototype, "build");
    const fetch = spyOn(globalThis, "fetch");
    for (const metadata of [undefined, { id: "0123456789ABCDEFGHJK" }, { target: "stash" }]) {
      await fs.writeFile(file, YAML.stringify({ "__sub-store": metadata, proxies: [] }));
      await expect(
        publishProfiles(file, { url: "https://example.test", token: "token" }),
      ).rejects.toThrow("Publishing requires __sub-store.id and __sub-store.target");
    }
    expect(builder).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  test("validates all private publishing metadata before building or fetching", async () => {
    const directory = await makeDirectory();
    await fs.writeFile(path.join(directory, "a-valid.yaml"), profile("0123456789ABCDEFGHJK"));
    const mihomo = spyOn(MihomoBuilder.prototype, "build");
    const stash = spyOn(StashBuilder.prototype, "build");
    const fetch = spyOn(globalThis, "fetch");
    for (const metadata of [
      { id: "private-invalid-id", target: "stash" },
      { id: "0123456789ABCDEFGHJM", target: "invalid" },
      { id: "0123456789ABCDEFGHJM", target: "stash", unexpected: "secret" },
      null,
    ]) {
      await fs.writeFile(
        path.join(directory, "z-invalid.yaml"),
        YAML.stringify({ "__sub-store": metadata }),
      );
      await expect(
        publishProfiles(directory, { url: "https://example.test", token: "token" }),
      ).rejects.toThrow();
    }
    expect(mihomo).not.toHaveBeenCalled();
    expect(stash).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
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
      profile("0123456789ABCDEFGHJK", "stash", { Cached: { type: "http", url: upstream } }),
    );

    const upstreamState = { available: true };
    let upstreamRequests = 0;
    const cachedFetcher = new Fetcher(
      ky.create({
        retry: 0,
        fetch: async (): Promise<Response> => {
          upstreamRequests += 1;
          if (!upstreamState.available) throw new TypeError("offline");
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
    upstreamState.available = false;

    const uploads: Record<string, unknown>[] = [];
    mockFetch(async (input, init) => {
      const request = new Request(input, init);
      uploads.push((await request.json()) as Record<string, unknown>);
      return new Response(null, { status: 204 });
    });

    await expect(
      publishProfiles(directory, { url: "https://example.test", token: "token" }),
    ).resolves.toBe(1);

    expect(upstreamRequests).toBe(2);
    expect(uploads).toHaveLength(1);
    const artifacts = uploads[0]!;
    for (const format of ["stash"]) {
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
