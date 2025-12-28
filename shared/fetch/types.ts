import type { Userinfo } from "@shared/schema/userinfo";

export type LocalFetchResult<T = string> = {
  content: T;
  userinfo: Userinfo;
};
