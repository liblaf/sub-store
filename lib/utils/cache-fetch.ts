import { createHash } from "node:crypto";
import fs from "node:fs/promises";
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

export class Fetcher {
  private dir: string;
  private ky: KyInstance;

  constructor(
    kyInstance?: KyInstance,
    dir?: string,
    private validator?: ResponseValidator,
  ) {
    this.dir = dir ?? path.join(userCacheDir("sub-store"), "fetch");
    this.ky = kyInstance ?? ky.create();
  }

  async fetch(
    url: string | URL,
    options?: Options,
    validator: ResponseValidator | undefined = this.validator,
  ): Promise<Response> {
    const key: string = this.makeKey(url, options);
    const cached: CacheEntry | null = await this.loadValidCache(key, validator);
    if (cached) {
      const age: number | undefined =
        cached.storedAt === undefined ? undefined : Date.now() - cached.storedAt;
      if (age !== undefined && age < 60 * 60 * 1000) {
        // 1 hour
        consola.success(`Cache hit: ${formatUrlForLog(url)}`);
        return withValidDate(cached.response);
      }
      consola.info(`Cache expired: ${formatUrlForLog(url)}`);
    } else {
      consola.info(`Cache miss: ${formatUrlForLog(url)}`);
    }
    let response: Response;
    try {
      response = await this.ky(url, options);
    } catch (err) {
      consola.warn(err);
      if (cached) return withValidDate(cached.response);
      throw err;
    }
    try {
      await this.validate(response, validator);
    } catch (err) {
      consola.warn(err);
      if (cached) return withValidDate(cached.response);
      throw err;
    }
    response = withValidDate(response);
    await this.saveCache(key, response.clone());
    return response;
  }

  private async loadValidCache(
    key: string,
    validator?: ResponseValidator,
  ): Promise<CacheEntry | null> {
    const cached: CacheEntry | null = await this.loadCache(key);
    if (!cached) return null;
    try {
      await this.validate(cached.response, validator);
      return cached;
    } catch (err) {
      consola.warn(err);
      return null;
    }
  }

  private async validate(response: Response, validator?: ResponseValidator): Promise<void> {
    await validator?.(response.clone());
  }

  protected async loadCache(key: string): Promise<CacheEntry | null> {
    const file: string = path.join(this.dir, key);
    if (!(await fs.exists(file))) return null;
    const { body, init, storedAt } = JSON.parse(await fs.readFile(file, "utf-8")) as CacheResponse;
    return { response: new Response(body, init), storedAt };
  }

  protected makeKey(input: string | URL, options?: Options): string {
    const serialized: string = JSON.stringify({ input, options });
    const hash: string = createHash("sha256").update(serialized).digest("hex");
    return `${hash}.json`;
  }

  protected async saveCache(key: string, response: Response): Promise<void> {
    const file: string = path.join(this.dir, key);
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(
      file,
      JSON.stringify({
        body: await response.text(),
        storedAt: Date.now(),
        init: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
        },
      }),
    );
  }
}

export const fetcher: Fetcher = new Fetcher();

export function formatUrlForLog(url: string | URL): string {
  return new URL(url).origin;
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
