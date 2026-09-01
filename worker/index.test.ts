import { describe, expect, test } from "bun:test";

import app from "./index";

type Metadata = { headers?: Record<string, string> };

function createEnv(entries: Record<string, { body: string; metadata?: Metadata }>): Env {
  return {
    KV: {
      async getWithMetadata(
        key: string,
      ): Promise<KVNamespaceGetWithMetadataResult<string, Metadata>> {
        const entry = entries[key];
        return entry
          ? { value: entry.body, metadata: entry.metadata ?? null, cacheStatus: null }
          : { value: null, metadata: null, cacheStatus: null };
      },
    } as KVNamespace,
  };
}

describe("subscription artifacts", (): void => {
  const id = "0123456789ABCDEFGHJK";
  const legacyId = "00000000-0000-4000-8000-000000000000";
  const env = createEnv({
    [`artifacts/${id}/mihomo.yaml`]: {
      body: "proxies: []\n",
      metadata: {
        headers: {
          "Subscription-Userinfo": "upload=1; download=2; total=3; expire=4",
        },
      },
    },
    [`artifacts/${id}/stash.yaml`]: {
      body: "proxy-groups: []\n",
    },
    [`artifacts/${legacyId}/stash.yaml`]: {
      body: "proxy-groups: []\n",
    },
  });

  test("serves Mihomo through its bearer path with stored metadata", async (): Promise<void> => {
    const response = await app.request(
      `https://example.test/subs/${id}/mihomo.yaml`,
      undefined,
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/yaml");
    expect(response.headers.get("Subscription-Userinfo")).toBe(
      "upload=1; download=2; total=3; expire=4",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(await response.text()).toBe(
      `#SUBSCRIBED https://subs.liblaf.me/subs/${id}/mihomo.yaml\nproxies: []\n`,
    );
  });

  test("serves Stash through its bearer path", async (): Promise<void> => {
    const response = await app.request(
      `https://example.test/subs/${id}/stash.yaml`,
      undefined,
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/yaml");
    expect(await response.text()).toBe(
      `#SUBSCRIBED https://subs.liblaf.me/subs/${id}/stash.yaml\nproxy-groups: []\n`,
    );
  });

  test("continues to serve existing UUID bearer paths", async (): Promise<void> => {
    const response = await app.request(
      `https://example.test/subs/${legacyId}/stash.yaml`,
      undefined,
      env,
    );

    expect(response.status).toBe(200);
    expect((await response.text()).split("\n", 1)).toEqual([
      `#SUBSCRIBED https://subs.liblaf.me/subs/${legacyId}/stash.yaml`,
    ]);
  });

  test("returns 404 for absent, invalid, and unsupported artifact locators", async (): Promise<void> => {
    for (const path of [
      `/subs/10000000-0000-4000-8000-000000000000/stash.yaml`,
      "/subs/not-a-profile-id/mihomo.yaml",
      `/subs/${id}/other.yaml`,
      `/subscribe/mihomo.yaml?id=${id}`,
    ]) {
      expect((await app.request(`https://example.test${path}`, undefined, env)).status).toBe(404);
    }
  });
});
