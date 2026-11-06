import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import path from "node:path";

import consola from "consola";
import ky from "ky";
import type { KyInstance, Options } from "ky";
import { userCacheDir } from "platformdirs";

type CacheResponse = {
  body: string;
  init: ResponseInit;
  storedAt?: number;
};

type CacheEntry = {
  response: Response;
  storedAt?: number;
};

export type ResponseValidator = (response: Response) => void | Promise<void>;

export const DAY_MS = 24 * 60 * 60 * 1000;
export const CACHE_TTL_MS = DAY_MS;

const staleResponses = new WeakSet<Response>();

export class Fetcher {
  private appOwnedDir: boolean;
  private dir: string;
  private ky: KyInstance;
  private pending = new Map<ResponseValidator | undefined, Map<string, Promise<Response>>>();

  constructor(
    kyInstance?: KyInstance,
    dir?: string,
    private validator?: ResponseValidator,
  ) {
    this.appOwnedDir = dir === undefined;
    this.dir = dir ?? path.join(userCacheDir("sub-store"), "fetch");
    this.ky = kyInstance ?? ky.create();
  }

  async fetch(
    url: string | URL,
    options?: Options,
    validator: ResponseValidator | undefined = this.validator,
  ): Promise<Response> {
    const key: string = this.makeKey(url, options);
    let requests = this.pending.get(validator);
    if (!requests) {
      requests = new Map();
      this.pending.set(validator, requests);
    }
    let pending = requests.get(key);
    if (!pending) {
      pending = this.fetchOnce(url, options, validator, key);
      requests.set(key, pending);
    }
    try {
      const response = await pending;
      const cloned = response.clone();
      if (isStaleResponse(response)) staleResponses.add(cloned);
      return cloned;
    } finally {
      if (requests.get(key) === pending) requests.delete(key);
      if (!requests.size) this.pending.delete(validator);
    }
  }

  private async fetchOnce(
    url: string | URL,
    options: Options | undefined,
    validator: ResponseValidator | undefined,
    key: string,
  ): Promise<Response> {
    await this.ensureCacheDirectory();
    let cached: CacheEntry | null = await this.loadCache(key);
    if (!cached && hasSafeLegacyHeaders(options?.headers)) {
      const legacyKey = `${createHash("sha256")
        .update(JSON.stringify({ input: url, options }))
        .digest("hex")}.json`;
      if (legacyKey !== key) cached = await this.loadCache(legacyKey);
    }
    if (cached) {
      const age: number | undefined =
        cached.storedAt === undefined ? undefined : Date.now() - cached.storedAt;
      if (age !== undefined && age >= 0 && age < CACHE_TTL_MS) {
        await this.validate(cached.response, validator);
        consola.success(`Cache hit: ${formatUrlForLog(url)}`);
        return withValidDate(cached.response);
      }
      consola.info(`Cache expired: ${formatUrlForLog(url)}`);
    } else {
      consola.info(`Cache miss: ${formatUrlForLog(url)}`);
    }
    let fetched: Response;
    try {
      fetched = await this.ky(url, options);
      if (!fetched.ok) throw new Error("Upstream returned an unsuccessful response");
      await this.validate(fetched, validator);
    } catch (error) {
      if (!cached) throw error;
      await this.validate(cached.response, validator);
      consola.warn(`Upstream fetch failed; using stale cache: ${formatUrlForLog(url)}`);
      staleResponses.add(cached.response);
      return cached.response;
    }
    const response: Response = withValidDate(fetched);
    await this.saveCache(key, response.clone());
    return response;
  }

  private async validate(response: Response, validator?: ResponseValidator): Promise<void> {
    await validator?.(response.clone());
  }

  protected async loadCache(key: string): Promise<CacheEntry | null> {
    const file: string = path.join(this.dir, key);
    let handle: FileHandle;
    try {
      handle = await fs.open(file, constants.O_NOFOLLOW | constants.O_RDONLY);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
    try {
      await handle.chmod(0o600);
      const { body, init, storedAt } = JSON.parse(await handle.readFile("utf-8")) as CacheResponse;
      return { response: new Response(body, init), storedAt };
    } finally {
      await handle.close();
    }
  }

  protected makeKey(input: string | URL, options?: Options): string {
    const headers = options?.headers;
    const entries: readonly (readonly [string, string | undefined])[] =
      headers instanceof Headers
        ? [...headers.entries()]
        : Array.isArray(headers)
          ? headers
          : Object.entries(headers ?? {});
    const normalizedHeaders = new Headers();
    for (const [name, value] of entries) {
      if (value !== undefined) normalizedHeaders.append(name, value);
    }
    const normalized = headers
      ? { ...options, headers: [...normalizedHeaders.entries()].sort() }
      : options;
    const serialized: string = JSON.stringify({ input: String(input), options: normalized });
    const hash: string = createHash("sha256").update(serialized).digest("hex");
    return `${hash}.json`;
  }

  protected async saveCache(key: string, response: Response): Promise<void> {
    const file: string = path.join(this.dir, key);
    const contents: string = JSON.stringify({
      body: await response.text(),
      storedAt: Date.now(),
      init: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      },
    });
    const temporary = `${file}.${randomUUID()}.tmp`;
    const handle = await fs.open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(contents);
      await handle.close();
      await fs.rename(temporary, file);
    } finally {
      await handle.close();
      await fs.rm(temporary, { force: true });
    }
  }

  private async ensureCacheDirectory(): Promise<void> {
    await fs.mkdir(this.dir, { mode: 0o700, recursive: true });
    if (this.appOwnedDir) await fs.chmod(this.dir, 0o700);
  }
}

export const fetcher: Fetcher = new Fetcher();

/** Whether a failed refresh caused this response to be served from an expired cache. */
export function isStaleResponse(response: Response): boolean {
  return staleResponses.has(response);
}

export function formatUrlForLog(url: string | URL): string {
  return new URL(url).origin;
}

function hasSafeLegacyHeaders(headers: Options["headers"]): boolean {
  if (headers === undefined) return true;
  // Legacy JSON serialization turned Headers into {}, losing credentials from the key.
  if (headers instanceof Headers) return false;
  if (Array.isArray(headers)) {
    return headers.every(
      (entry) =>
        Array.isArray(entry) &&
        entry.length === 2 &&
        typeof entry[0] === "string" &&
        typeof entry[1] === "string",
    );
  }
  const prototype = Object.getPrototypeOf(headers);
  return prototype === Object.prototype || prototype === null;
}

function withValidDate(response: Response): Response {
  const date: string | null = response.headers.get("date");
  if (date && Number.isFinite(Date.parse(date))) return response;
  const headers = new Headers(response.headers);
  headers.set("date", new Date().toUTCString());
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
