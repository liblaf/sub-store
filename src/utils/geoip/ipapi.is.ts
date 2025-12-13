import DataLoader from "dataloader";
import ky from "ky";
import * as R from "remeda";
import z from "zod";

const RESPONSE_SCHEMA: z.ZodObject<{
  ip: z.ZodUnion<readonly [z.ZodIPv4, z.ZodIPv6]>;
  location: z.ZodOptional<z.ZodObject<{ country_code: z.ZodString }>>;
}> = z.looseObject({
  ip: z.union([z.ipv4(), z.ipv6()]),
  location: z.looseObject({ country_code: z.string().length(2) }).optional(),
});
export type GeoIpApiResponse = z.infer<typeof RESPONSE_SCHEMA>;

const BULK_RESPONSE_SCHEMA: z.ZodRecord<z.ZodString, typeof RESPONSE_SCHEMA> =
  z.record(z.string(), RESPONSE_SCHEMA);
type BulkApiResponse = z.infer<typeof BULK_RESPONSE_SCHEMA>;

export class IpapiIs {
  public readonly endpoints: string = "https://api.ipapi.is/";
  private loader: DataLoader<string, GeoIpApiResponse>;
  private readonly key?: string;

  public constructor() {
    this.loader = new DataLoader(
      async (ips: readonly string[]): Promise<GeoIpApiResponse[]> =>
        await this.batchLoadFn(ips),
      { maxBatchSize: 100 },
    );
    this.key = process.env.IPAPI_IS_KEY;
  }

  public async lookup(ip: string): Promise<GeoIpApiResponse> {
    return await this.loader.load(ip);
  }

  protected async batchLoadFn(
    ips: readonly string[],
  ): Promise<GeoIpApiResponse[]> {
    let data: any = await ky
      .post(this.endpoints, { json: { ips, key: this.key } })
      .json();
    data = R.omit(data, ["total_elapsed_ms"]);
    const response: BulkApiResponse = BULK_RESPONSE_SCHEMA.parse(data);
    return ips.map((ip: string): GeoIpApiResponse => response[ip]!);
  }
}
