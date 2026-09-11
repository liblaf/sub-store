import { describe, expect, test } from "bun:test";

import { MAX_UPLOAD_BYTES } from "@/lib/publish/schema";

import app from "./index";

type Metadata = { headers?: Record<string, string> };
type StoredArtifact = { body: string; metadata?: Metadata };

function createEnv(setup: { failKey?: string; token?: string } = {}): {
  env: Env;
  entries: Map<string, StoredArtifact>;
  writes: string[];
} {
  const entries = new Map<string, StoredArtifact>();
  const writes: string[] = [];
  const env = {
    KV: {
      async getWithMetadata(
        key: string,
      ): Promise<KVNamespaceGetWithMetadataResult<string, Metadata>> {
        const entry = entries.get(key);
        return entry
          ? { value: entry.body, metadata: entry.metadata ?? null, cacheStatus: null }
          : { value: null, metadata: null, cacheStatus: null };
      },
      async put(key: string, body: string, options?: KVNamespacePutOptions): Promise<void> {
        writes.push(key);
        if (key === setup.failKey) throw new Error("KV write failed");
        entries.set(key, { body, metadata: options?.metadata as Metadata | undefined });
      },
    } as KVNamespace,
    ...(setup.token === undefined ? {} : { SUB_STORE_API_TOKEN: setup.token }),
  } as Env;
  return { env, entries, writes };
}

const id = "0123456789ABCDEFGHJK";
const path = `https://example.test/api/profiles/${id}/artifacts`;
const token = "test-token";
const upload = {
  mihomo: {
    body: "proxies: []\n",
    metadata: { headers: { "Subscription-Userinfo": "upload=1; total=2" } },
  },
  stash: {
    body: "proxy-groups: []\n",
    metadata: { headers: {} },
  },
};

function put(body: BodyInit, authorization = `Bearer ${token}`): RequestInit {
  return {
    method: "PUT",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body,
  };
}

describe("artifact upload", (): void => {
  test("rejects missing and invalid authorization without KV writes", async (): Promise<void> => {
    for (const authorization of [undefined, "Bearer wrong-token"]) {
      const { env, writes } = createEnv({ token });
      const headers = new Headers({ "Content-Type": "application/json" });
      if (authorization) headers.set("Authorization", authorization);
      const response = await app.request(path, { method: "PUT", headers, body: "not JSON" }, env);

      expect(response.status).toBe(401);
      expect(response.headers.has("WWW-Authenticate")).toBe(true);
      expect(writes).toEqual([]);
    }
  });

  test("fails closed when the Worker secret is unavailable", async (): Promise<void> => {
    const { env, writes } = createEnv();
    const response = await app.request(path, put(JSON.stringify(upload)), env);

    expect(response.status).toBe(401);
    expect(writes).toEqual([]);
  });

  test("rejects malformed authorization without processing the body", async (): Promise<void> => {
    const { env, writes } = createEnv({ token });
    const response = await app.request(path, put("not JSON", "Basic invalid"), env);

    expect(response.status).toBe(400);
    expect(writes).toEqual([]);
  });

  test("rejects invalid JSON, invalid payloads, oversized bodies, and invalid IDs without writes", async (): Promise<void> => {
    const cases: Array<{ path: string; body: BodyInit; status: number }> = [
      { path, body: "not json", status: 400 },
      { path, body: JSON.stringify({ mihomo: upload.mihomo }), status: 400 },
      { path, body: "x".repeat(MAX_UPLOAD_BYTES + 1), status: 413 },
      {
        path: "https://example.test/api/profiles/not-a-profile-id/artifacts",
        body: JSON.stringify(upload),
        status: 404,
      },
    ];
    for (const testCase of cases) {
      const { env, writes } = createEnv({ token });
      const response = await app.request(testCase.path, put(testCase.body), env);

      expect(response.status).toBe(testCase.status);
      expect(writes).toEqual([]);
    }
  });

  test("writes both artifacts and serves their metadata", async (): Promise<void> => {
    const { env, writes } = createEnv({ token });
    const response = await app.request(path, put(JSON.stringify(upload)), env);

    expect(response.status).toBe(204);
    expect(writes).toEqual([`artifacts/${id}/mihomo.yaml`, `artifacts/${id}/stash.yaml`]);

    const downloaded = await app.request(
      `https://example.test/subs/${id}/mihomo.yaml`,
      undefined,
      env,
    );
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get("Subscription-Userinfo")).toBe("upload=1; total=2");
    expect(await downloaded.text()).toBe(
      `#SUBSCRIBED https://subs.liblaf.me/subs/${id}/mihomo.yaml\nproxies: []\n`,
    );
  });

  test("rejects unsafe or oversized metadata before either KV write", async (): Promise<void> => {
    for (const headers of [
      { "Set-Cookie": "private=value" },
      { "Subscription-Userinfo": "upload=1\r\nX-Injected: value" },
      { "Subscription-Userinfo": "\\".repeat(600) },
    ]) {
      const { env, writes } = createEnv({ token });
      const payload = { ...upload, stash: { ...upload.stash, metadata: { headers } } };
      const response = await app.request(path, put(JSON.stringify(payload)), env);

      expect(response.status).toBe(400);
      expect(writes).toEqual([]);
    }
  });

  test("returns an error when a KV write fails", async (): Promise<void> => {
    const { env } = createEnv({ token, failKey: `artifacts/${id}/stash.yaml` });
    const response = await app.request(path, put(JSON.stringify(upload)), env);

    expect(response.status).toBe(500);
  });
});
