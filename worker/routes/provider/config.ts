import type {
  Filters,
  HonoOpenAPIRouterType,
  ListFilters,
  ListResult,
  MetaInput,
  OpenAPIRoute,
} from "chanfana";
import {
  CreateEndpoint,
  DeleteEndpoint,
  ListEndpoint,
  ReadEndpoint,
} from "chanfana";
import type { Context, Env, Schema } from "hono";
import { env } from "hono/adapter";
import z from "zod";
import { GetProviderMihomo } from "./content";

const PROVIDER_SCHEMA = z.object({
  name: z.string(),
  jms: z
    .object({
      url: z.url(),
      api: z.url(),
    })
    .optional(),
  mihomo: z.url().optional(),
});

type Provider = z.infer<typeof PROVIDER_SCHEMA>;

const providerMeta = {
  model: {
    tableName: "providers",
    schema: PROVIDER_SCHEMA,
    primaryKeys: ["name"],
  },
  pathParameters: ["name"],
} satisfies MetaInput;

export class CreateProvider extends CreateEndpoint {
  override _meta = providerMeta;

  override async create(data: Provider): Promise<Provider> {
    const c = getContext(this);
    const providers = await getProviders(this);
    providers[data.name] = data;
    await env(c).SUB.put("providers", JSON.stringify(providers));
    return data;
  }
}

export class ReadProvider extends ReadEndpoint {
  override _meta = providerMeta;

  override async fetch(filters: ListFilters): Promise<Provider | null> {
    return await getObject(this, filters);
  }
}

export class DeleteProvider extends DeleteEndpoint {
  override _meta = providerMeta;

  override async getObject(filters: Filters): Promise<Provider | null> {
    return getObject(this, filters);
  }

  override async delete(
    oldObj: Provider,
    _filters: Filters,
  ): Promise<Provider | null> {
    const c = getContext(this);
    const providers = await getProviders(this);
    delete providers[oldObj.name];
    await env(c).SUB.put("providers", JSON.stringify(providers));
    return oldObj;
  }
}

export class ListProviders extends ListEndpoint {
  override _meta = providerMeta;

  override async list(_filters: ListFilters): Promise<ListResult<Provider>> {
    const providers = await getProviders(this);
    return { result: Object.values(providers) };
  }
}

export function registerProviderRoutes<
  E extends Env,
  S extends Schema,
  BasePath extends string,
>(openapi: HonoOpenAPIRouterType<E, S, BasePath>): void {
  openapi.post("/api/providers", CreateProvider);
  openapi.get("/api/providers/:name", ReadProvider);
  openapi.delete("/api/providers/:name", DeleteProvider);
  openapi.get("/api/providers", ListProviders);
  openapi.get("/api/providers/:name/mihomo.yaml", GetProviderMihomo);
}

function getContext(
  route: OpenAPIRoute,
): Context<{ Bindings: CloudflareBindings }> {
  return route.args[0] as Context<{ Bindings: CloudflareBindings }>;
}

async function getProviders(
  route: OpenAPIRoute,
): Promise<Record<string, Provider>> {
  const c = getContext(route);
  const schema = z.record(z.string(), PROVIDER_SCHEMA);
  const response = schema.parse(await env(c).SUB.get("providers", "json"));
  return response;
}

async function getObject(
  route: OpenAPIRoute,
  filters: Filters,
): Promise<Provider | null> {
  let providers = Object.values(await getProviders(route));
  for (const filter of filters.filters) {
    if (filter.field === "name")
      providers = providers.filter((p) => p.name === filter.value);
    else throw new Error(`Unsupported filter field: ${filter.field}`);
  }
  if (providers.length === 0) return null;
  if (providers.length > 1)
    throw new Error(`Multiple providers found for filters: ${filters}`);
  return providers[0]!;
}
