import type {
  FilterCondition,
  Filters,
  ListFilters,
  ListResult,
  MetaInput,
  OpenAPIRoute,
  OpenAPIRouteSchema,
} from "chanfana";
import {
  CreateEndpoint,
  DeleteEndpoint,
  InputValidationException,
  ListEndpoint,
  ReadEndpoint,
} from "chanfana";
import { env } from "hono/adapter";
import type { Context } from "../../../_utils";
import type { RequestMethod } from "../../_utils";
import { getContext } from "../../_utils";
import { getProviders, putProviders } from "./_kv";
import type { Provider, Providers } from "./_schema";
import { PROVIDER_SCHEMA } from "./_schema";

export const META = {
  model: {
    tableName: "providers",
    schema: PROVIDER_SCHEMA,
    primaryKeys: ["name"],
  },
} satisfies MetaInput;

export class CreateProvider extends CreateEndpoint {
  static method: RequestMethod = "post";
  static path: string = "/api/providers/:name";

  override schema = {
    tags: ["Providers"],
    summary: "Create Provider",
  } satisfies OpenAPIRouteSchema;

  override _meta = META;

  override async create(data: Provider): Promise<Provider> {
    const c: Context = getContext(this);
    const kv: KVNamespace = env(c).SUB;
    const providers: Providers = await getProviders(kv);
    providers[data.name] = data;
    await putProviders(kv, providers);
    return data;
  }
}

export class ReadProvider extends ReadEndpoint {
  static method: RequestMethod = "get";
  static path: string = "/api/providers/:name";

  override schema = {
    tags: ["Providers"],
    summary: "Read Provider",
  } satisfies OpenAPIRouteSchema;

  override _meta = META;

  override async fetch(filters: ListFilters): Promise<Provider | null> {
    return filterProvider(this, filters);
  }
}

export class DeleteProvider extends DeleteEndpoint {
  static method: RequestMethod = "delete";
  static path: string = "/api/providers/:name";

  override schema = {
    tags: ["Providers"],
    summary: "Delete Provider",
  } satisfies OpenAPIRouteSchema;

  override _meta = META;

  override async getObject(filters: Filters): Promise<Provider | null> {
    return filterProvider(this, filters);
  }

  override async delete(
    oldObj: Provider,
    _filters: Filters,
  ): Promise<Provider | null> {
    const c: Context = getContext(this);
    const kv: KVNamespace = env(c).SUB;
    const providers: Providers = await getProviders(kv);
    delete providers[oldObj.name];
    await putProviders(kv, providers);
    return oldObj;
  }
}

export class ListProviders extends ListEndpoint {
  static method: RequestMethod = "get";
  static path: string = "/api/providers";

  override schema = {
    tags: ["Providers"],
    summary: "List Providers",
  } satisfies OpenAPIRouteSchema;

  override _meta = META;

  override async list(filters: ListFilters): Promise<ListResult<Provider>> {
    if (filters.filters.length > 0) throw new InputValidationException();
    const c: Context = getContext(this);
    const kv: KVNamespace = env(c).SUB;
    const providers: Providers = await getProviders(kv);
    const result: Provider[] = Object.values(providers);
    return { result };
  }
}

async function filterProvider(
  self: OpenAPIRoute,
  filters: Filters,
): Promise<Provider | null> {
  if (filters.filters.length !== 1) throw new InputValidationException();
  const filter: FilterCondition = filters.filters[0]!;
  if (
    filter.field !== "name" ||
    typeof filter.value !== "string" ||
    filter.operator !== "EQ"
  )
    throw new InputValidationException();
  const name: string = filter.value;
  const c: Context = getContext(self);
  const kv: KVNamespace = env(c).SUB;
  const providers: Providers = await getProviders(kv);
  return providers[name] || null;
}
