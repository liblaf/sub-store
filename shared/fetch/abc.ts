import type { Provider } from "@shared/schema/provider";
import { Sublink } from "./sublink";
import type { LocalFetchResult } from "./types";

export abstract class LocalFetcher<T> {
  protected sublink: Sublink;

  constructor(sublink?: Sublink) {
    this.sublink = sublink ?? new Sublink();
  }

  abstract fetch(provider: Provider): Promise<LocalFetchResult<T>>;
}
