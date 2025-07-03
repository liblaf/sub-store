import { Cacheable } from "@type-cacheable/core";
import z from "zod";

export const PROVIDER_SCHEMA: z.ZodObject<{ name: z.ZodString }> = z.object({
  name: z.string(),
});

export type ProviderParams = z.input<typeof PROVIDER_SCHEMA>;

export type ProviderParsed = z.infer<typeof PROVIDER_SCHEMA>;

export class Provider {
  public name: string;

  constructor(params: ProviderParams) {
    const parsed: ProviderParsed = PROVIDER_SCHEMA.parse(params);
    this.name = parsed.name;
  }

  @Cacheable({})
  async mihomo(): Promise<void> {}
}
