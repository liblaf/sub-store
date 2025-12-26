import type { OpenAPIRoute, RequestMethod } from "@worker/app/_abc";
import {
  CreateEndpoint,
  DeleteEndpoint,
  ListEndpoint,
  ReadEndpoint,
} from "@worker/app/_abc";
import type { Provider, Providers } from "@worker/kv";
import { PROVIDER_SCHEMA, ProviderStore } from "@worker/kv";
import type {
  FilterCondition,
  Filters,
  ListFilters,
  ListResult,
  MetaInput,
  OpenAPIRouteSchema,
} from "chanfana";
import { InputValidationException } from "chanfana";

export const META = {
  model: {
    tableName: "providers",
    schema: PROVIDER_SCHEMA,
    primaryKeys: ["name"],
  },
} satisfies MetaInput;

export class CreateProvider extends CreateEndpoint {
  static override method: RequestMethod = "post";
  static override path: string = "/api/providers/:name";

  override schema = {
    tags: ["Providers"],
    summary: "Create Provider",
  } satisfies OpenAPIRouteSchema;

  override _meta = META;

  override async create(data: Provider): Promise<Provider> {
    const store = new ProviderStore(this.kv);
    return await store.create(data);
  }
}

export class ReadProvider extends ReadEndpoint {
  static override method: RequestMethod = "get";
  static override path: string = "/api/providers/:name";

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
  static override method: RequestMethod = "delete";
  static override path: string = "/api/providers/:name";

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
    const store = new ProviderStore(this.kv);
    return await store.delete(oldObj.name);
  }
}

export class ListProviders extends ListEndpoint {
  static override method: RequestMethod = "get";
  static override path: string = "/api/providers";

  override schema = {
    tags: ["Providers"],
    summary: "List Providers",
  } satisfies OpenAPIRouteSchema;

  override _meta = META;

  override async list(filters: ListFilters): Promise<ListResult<Provider>> {
    if (filters.filters.length > 0) throw new InputValidationException();
    const store = new ProviderStore(this.kv);
    const providers: Providers = await store.list();
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
  const store = new ProviderStore(self.kv);
  return await store.read(name);
}
