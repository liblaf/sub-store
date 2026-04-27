import type { Country } from "world-countries";

import { COUNTRY_UNKNOWN } from "../pipeline/infer/country";

export type ProxyWrapper<T = unknown> = {
  name: string;
  pretty: string;
  wrapped: T;

  country: Country;
  info: boolean;
};

export function createProxyWrapper<T = unknown>(
  partial: Partial<ProxyWrapper<T>> & Pick<ProxyWrapper<T>, "name" | "wrapped">,
): ProxyWrapper<T> {
  return {
    name: partial.name,
    pretty: partial.pretty ?? partial.name,
    wrapped: partial.wrapped,
    country: partial.country ?? COUNTRY_UNKNOWN,
    info: partial.info ?? false,
  };
}
