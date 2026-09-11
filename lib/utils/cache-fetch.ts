import { createHash } from "node:crypto";
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

export class Fetcher {
  private appOwnedDir: boolean;
  private dir: string;
  private ky: KyInstance;

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
    await this.ensureCacheDirectory();
    const key: string = this.makeKey(url, options);
    const cached: CacheEntry | null = await this.loadCache(key);
    if (cached) {
      const age: number | undefined =
        cached.storedAt === undefined ? undefined : Date.now() - cached.storedAt;
      if (age !== undefined && age < 60 * 60 * 1000) {
        // 1 hour
        await this.validate(cached.response, validator);
        consola.success(`Cache hit: ${formatUrlForLog(url)}`);
        return withValidDate(cached.response);
      }
      consola.info(`Cache expired: ${formatUrlForLog(url)}`);
    } else {
      consola.info(`Cache miss: ${formatUrlForLog(url)}`);
    }
    const fetched: Response = await this.ky(url, options);
    await this.validate(fetched, validator);
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
    const serialized: string = JSON.stringify({ input, options });
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
    const handle = await fs.open(
      file,
      constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_WRONLY,
      0o600,
    );
    try {
      await handle.chmod(0o600);
      await handle.truncate(0);
      await handle.writeFile(contents);
    } finally {
      await handle.close();
    }
  }

  private async ensureCacheDirectory(): Promise<void> {
    await fs.mkdir(this.dir, { mode: 0o700, recursive: true });
    if (this.appOwnedDir) await fs.chmod(this.dir, 0o700);
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
