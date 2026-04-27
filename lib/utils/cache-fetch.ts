import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import ky from "ky";
import type { KyInstance, Options } from "ky";
import { userCacheDir } from "platformdirs";

type CacheResponse = {
  body: string;
  init: ResponseInit;
};

export class Fetcher {
  private dir: string;
  private ky: KyInstance;

  constructor(kyInstance?: KyInstance, dir?: string) {
    this.dir = dir ?? path.join(userCacheDir("sub-store"), "fetch");
    this.ky = kyInstance ?? ky.create();
  }

  async fetch(url: string | URL, options?: Options): Promise<Response> {
    const key: string = this.makeKey(url, options);
    const cached: Response | null = await this.loadCache(key);
    if (cached) {
      const date: number = Date.parse(cached.headers.get("Date")!);
      const age: number = Date.now() - date;
      if (age < 60 * 60 * 1000) return cached; // 1 hour
    }
    let response: Response;
    try {
      response = await this.ky(url, options);
    } catch (err) {
      console.error(err);
      if (cached) return cached;
      throw err;
    }
    await this.saveCache(key, response.clone());
    return response;
  }

  protected async loadCache(key: string): Promise<Response | null> {
    const file: string = path.join(this.dir, key);
    if (!(await fs.exists(this.dir))) return null;
    const { body, init } = JSON.parse(await fs.readFile(file, "utf-8")) as CacheResponse;
    return new Response(body, init);
  }

  protected makeKey(input: string | URL, options?: Options): string {
    const serialized: string = JSON.stringify({ input, options });
    const hash: string = createHash("sha256").update(serialized).digest("hex");
    return `${hash}.json`;
  }

  protected async saveCache(key: string, response: Response): Promise<void> {
    if (!response.headers.has("date")) {
      response.headers.set("date", new Date().toUTCString());
    }
    const file: string = path.join(this.dir, key);
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(
      file,
      JSON.stringify({
        body: await response.text(),
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
