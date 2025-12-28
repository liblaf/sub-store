import type { Provider, Providers } from "@shared/schema/provider";
import { PROVIDER_SCHEMA } from "@shared/schema/provider";
import { ProviderStore } from "@worker/kv/provider";
import type { RequestMethod } from "@worker/utils/route";
import type {
  Filters,
  ListFilters,
  ListResult,
  MetaInput,
  OpenAPIRouteSchema,
} from "chanfana";
import {
  CreateEndpoint,
  DeleteEndpoint,
  InputValidationException,
  ListEndpoint,
  ReadEndpoint,
} from "chanfana";

export const META = {
  model: {
    tableName: "providers",
    schema: PROVIDER_SCHEMA,
    primaryKeys: ["id"],
  },
} satisfies MetaInput;

export class CreateProvider extends CreateEndpoint {
  static method: RequestMethod = "post";
  static path: string = "/api/providers/:id";

  override schema = {
    tags: ["Providers"],
    summary: "Create Provider",
  } satisfies OpenAPIRouteSchema;

  override _meta = META;

  override async create(data: Provider): Promise<Provider> {
    const store = new ProviderStore(this.kv);
    return await store.create(data.id, data);
  }
}

export class ReadProvider extends ReadEndpoint {
  static method: RequestMethod = "get";
  static path: string = "/api/providers/:id";

  override schema = {
    tags: ["Providers"],
    summary: "Read Provider",
  } satisfies OpenAPIRouteSchema;

  override _meta = META;

  override async fetch(filters: ListFilters): Promise<Provider | null> {
    const store = new ProviderStore(this.kv);
    return await store.filter(filters);
  }
}

export class DeleteProvider extends DeleteEndpoint {
  static method: RequestMethod = "delete";
  static path: string = "/api/providers/:id";

  override schema = {
    tags: ["Providers"],
    summary: "Delete Provider",
  } satisfies OpenAPIRouteSchema;

  override _meta = META;

  override async getObject(filters: Filters): Promise<Provider | null> {
    const store = new ProviderStore(this.kv);
    return await store.filter(filters);
  }

  override async delete(
    oldObj: Provider,
    _filters: Filters,
  ): Promise<Provider | null> {
    const store = new ProviderStore(this.kv);
    return await store.delete(oldObj.id);
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
    const store = new ProviderStore(this.kv);
    const providers: Providers = await store.list();
    const result: Provider[] = Object.values(providers);
    return { result };
  }
}
