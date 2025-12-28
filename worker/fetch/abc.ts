import { Sublink } from "@shared/fetch/sublink";
import type { LocalFetchResult } from "@shared/fetch/types";
import type { Provider } from "@shared/schema/provider";
import type { Userinfo } from "@shared/schema/userinfo";
import type {
  ArtifactMetadata,
  ArtifactWithMetadata,
} from "@worker/kv/artifact";
import { ProviderStore } from "@worker/kv/provider";
import type { Context } from "@worker/types";
import { ApiException, MultiException, NotFoundException } from "chanfana";
import { env } from "hono/adapter";

export type WorkerFetchMetadata = {
  fromCache: boolean;
  mtime: number;
};

export type WorkerFetchResult<T> = LocalFetchResult<T> & {
  metadata: WorkerFetchMetadata;
};

export abstract class WorkerFetcher<T = string> {
  abstract filename: string;

  constructor(protected ctx: Context) {}

  get kv(): KVNamespace {
    return env(this.ctx).SUB;
  }

  get store(): ProviderStore {
    return new ProviderStore(this.kv);
  }

  get sublink(): Sublink {
    return new Sublink(env(this.ctx).SUBLINK_URL, env(this.ctx).SUBLINK);
  }

  async fetch(provider: Provider): Promise<WorkerFetchResult<T>> {
    const errors: unknown[] = [];
    try {
      const result: WorkerFetchResult<T> = await this.fetchFromOrigin(provider);
      const { id } = provider;
      const { content, userinfo } = result;
      await this.store.artifacts.create(id, this.filename, content);
      await this.store.artifacts.create(id, "userinfo.json", userinfo);
      return result;
    } catch (err) {
      this.ctx.header("X-Error", `${err}`);
      errors.push(err);
    }
    try {
      const result: WorkerFetchResult<T> = await this.fetchFromCache(provider);
      return result;
    } catch (err) {
      this.ctx.header("X-Error", `${err}`, { append: true });
      errors.push(err);
    }
    throw new MultiException(
      errors.map((err: unknown): ApiException => {
        if (err instanceof ApiException) return err;
        return new ApiException(`${err}`);
      }),
    );
  }

  async fetchFromOrigin(_provider: Provider): Promise<WorkerFetchResult<T>> {
    throw new Error("fetchFromOrigin() Not Implemented");
  }

  async fetchFromCache({ id }: Provider): Promise<WorkerFetchResult<T>> {
    let content: T | null;
    let metadata: ArtifactMetadata | null;
    if (this.filename.endsWith(".json")) {
      const result: ArtifactWithMetadata<T> =
        await this.store.artifacts.json<T>(id, this.filename);
      content = result.content;
      metadata = result.metadata;
    } else {
      const result: ArtifactWithMetadata<string> =
        await this.store.artifacts.text(id, this.filename);
      content = result.content as T;
      metadata = result.metadata;
    }
    if (!content || !metadata) {
      throw new NotFoundException(
        `Not found in KV: providers/${id}/${this.filename}`,
      );
    }
    const { content: userinfo } = await this.store.artifacts.json<Userinfo>(
      id,
      "userinfo.json",
    );
    return {
      content: content,
      userinfo: userinfo ?? {},
      metadata: {
        fromCache: true,
        mtime: metadata.mtime,
      },
    };
  }
}
