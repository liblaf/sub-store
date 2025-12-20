import type { OpenAPIRouteSchema } from "chanfana";
import { OpenAPIRoute } from "chanfana";
import { env } from "hono/adapter";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import z from "zod";
import type { Context } from "../../../../types";
import type { Provider } from "../_schema";
import { getProviders } from "../_utils";

type UserInfo = {
  upload: number;
  download: number;
  total: number;
  expire: number;
};

type CacheStatus = {
  from_cache: boolean;
  last_update: Date;
};

type FetchMihomoResult = {
  content: string;
  userinfo?: UserInfo;
  cacheStatus: CacheStatus;
};

export class ApiProvidersNameMihomoGet extends OpenAPIRoute {
  override schema = {
    request: {
      params: z.object({ name: z.string() }),
      query: z.object({
        convert: z.boolean().default(true),
        refresh: z.boolean().default(false),
      }),
    },
    responses: {
      200: {
        description: "OK",
        headers: z.object({
          "Subscription-Userinfo": z.string().optional(),
        }),
        content: {
          "application/yaml": { schema: z.string() },
        },
      },
    },
  } satisfies OpenAPIRouteSchema;

  override async handle(c: Context): Promise<Response> {
    const { params, query } = await this.getValidatedData<typeof this.schema>();
    const name: string = params.name;
    const providers: Record<string, Provider> = await getProviders(c);
    const provider: Provider | undefined = providers[name];
    if (!provider) return c.notFound();
    const result: FetchMihomoResult | null = await fetchMihomo(
      c,
      provider,
      query,
    );
    if (!result) return c.notFound();
    const { content, userinfo, cacheStatus } = result;
    if (userinfo) {
      c.header(
        "Subscription-Userinfo",
        Object.entries(userinfo)
          .map(([key, value]: [string, number]): string => `${key}=${value}`)
          .join("; "),
      );
    }
    c.header("X-From-Cache", `${cacheStatus.from_cache}`);
    c.header("X-Last-Update", cacheStatus.last_update.toISOString());
    return c.text(content, 200, { "Content-Type": "application/yaml" });
  }
}

async function fetchMihomo(
  c: Context,
  provider: Provider,
  query: {
    convert: boolean;
    refresh: boolean;
  },
): Promise<FetchMihomoResult | null> {
  const sources: (() => Promise<FetchMihomoResult>)[] = [];
  if (provider.mihomo) {
    sources.push(
      async (): Promise<FetchMihomoResult> =>
        await fetchMihomoFromUrl(provider.mihomo!),
    );
  }
  if (query.convert) {
    if (provider.xray) {
      sources.push(async (): Promise<FetchMihomoResult> => {
        const url = new URL(env(c).SUBLINK_URL);
        url.searchParams.set("config", provider.xray!);
        return await fetchMihomoFromUrl(url);
      });
    }
  }
  if (!query.refresh) {
    sources.push(
      async (): Promise<FetchMihomoResult> =>
        await fetchMihomoFromCache(c, provider),
    );
  }

  let firstError: any = null;
  for (const source of sources) {
    try {
      return await source();
    } catch (err) {
      console.error(err);
      if (!firstError) firstError = err;
    }
  }
  if (firstError) throw firstError;
  throw new HTTPException(404, {
    message: `No mihomo.yaml source available for provider ${provider.name}`,
  });
}

async function fetchMihomoFromUrl(
  url: string | URL,
): Promise<FetchMihomoResult> {
  const response = await fetch(url, {
    headers: { "User-Agent": "clash.meta" },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new HTTPException(response.status as ContentfulStatusCode, {
      res: response,
      message: `Failed to fetch mihomo.yaml from ${url}`,
    });
  }
  const content: string = await response.text();
  const userinfoHeader: string | null = response.headers.get(
    "Subscription-Userinfo",
  );
  let userinfo: UserInfo | undefined;
  if (userinfoHeader) {
    for (const part of userinfoHeader.split(";")) {
      let [key, value] = part.trim().split("=");
      if (!(key && value)) continue;
      key = key.trim();
      value = value.trim();
      if (!key || Number.isNaN(+value)) continue;
      if (!userinfo)
        userinfo = {
          upload: 0,
          download: 0,
          total: 0,
          expire: 0,
        };
      userinfo[key as keyof UserInfo] = +value;
    }
  }
  return {
    content,
    userinfo,
    cacheStatus: {
      from_cache: false,
      last_update: new Date(),
    },
  };
}

async function fetchMihomoFromCache(
  c: Context,
  provider: Provider,
): Promise<FetchMihomoResult> {
  const result = await env(c).SUB.getWithMetadata(
    `provider:${provider.name}:mihomo.yaml`,
    { type: "text" },
  );
  if (result.value === null)
    throw new HTTPException(404, {
      message: `No cached mihomo.yaml for provider ${provider.name}`,
    });
  const { userinfo, last_update } = z
    .object({
      userinfo: z
        .object({
          upload: z.number(),
          download: z.number(),
          total: z.number(),
          expire: z.number(),
        })
        .optional(),
      last_update: z.date(),
    })
    .parse(result.metadata);
  return {
    content: result.value,
    userinfo,
    cacheStatus: {
      from_cache: true,
      last_update,
    },
  };
}
