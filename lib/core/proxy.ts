export type ProxyWrapper<T = unknown> = {
  name: string;
  pretty: string;
  wrapped: T;

  /** True only for metadata proxies synthesized by this application. */
  info: boolean;
};

export function createProxyWrapper<T = unknown>(
  partial: Partial<ProxyWrapper<T>> & Pick<ProxyWrapper<T>, "name" | "wrapped">,
): ProxyWrapper<T> {
  return {
    name: partial.name,
    pretty: partial.pretty ?? partial.name,
    wrapped: partial.wrapped,
    info: partial.info ?? false,
  };
}
