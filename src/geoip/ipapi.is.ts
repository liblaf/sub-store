import DataLoader from "dataloader";
import ky from "ky";
import * as R from "remeda";
import z from "zod";

const RESPONSE_SCHEMA = z.looseObject({
  ip: z.union([z.ipv4(), z.ipv6()]),
  location: z.looseObject({ country_code: z.string().length(2) }).optional(),
});
export type ApiResponse = z.infer<typeof RESPONSE_SCHEMA>;
const BULK_RESPONSE_SCHEMA = z.record(z.string(), RESPONSE_SCHEMA);
type BulkApiResponse = z.infer<typeof BULK_RESPONSE_SCHEMA>;

export class IpapiIs {
  public readonly endpoints: string = "https://api.ipapi.is/";
  private loader: DataLoader<string, ApiResponse>;
  private readonly key?: string;

  public constructor() {
    this.loader = new DataLoader(
      async (ips: readonly string[]): Promise<ApiResponse[]> =>
        await this.batchLoadFn(ips),
      { maxBatchSize: 100 },
    );
    this.key = process.env.IPAPI_IS_KEY;
  }

  public async lookup(ip: string): Promise<ApiResponse> {
    return await this.loader.load(ip);
  }

  protected async batchLoadFn(ips: readonly string[]): Promise<ApiResponse[]> {
    let data: any = await ky
      .post(this.endpoints, { json: { ips, key: this.key } })
      .json();
    data = R.omit(data, ["total_elapsed_ms"]);
    const response: BulkApiResponse = BULK_RESPONSE_SCHEMA.parse(data);
    return ips.map((ip: string): ApiResponse => response[ip]!);
  }
}
