import type { OpenAPIRoute, RequestMethod } from "@worker/app/_abc";
import {
  CreateEndpoint,
  DeleteEndpoint,
  ListEndpoint,
  ReadEndpoint,
} from "@worker/app/_abc";
import type { Profile, Profiles, Providers } from "@worker/kv";
import { PROFILE_SCHEMA, ProfileStore, ProviderStore } from "@worker/kv";
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
    tableName: "profiles",
    primaryKeys: ["id"],
    schema: PROFILE_SCHEMA,
  },
} satisfies MetaInput;

export class CreateProfile extends CreateEndpoint {
  static override method: RequestMethod = "post";
  static override path: string = "/api/profiles/:id";

  override schema = {
    tags: ["Profiles"],
    summary: "Create Profile",
  } satisfies OpenAPIRouteSchema;

  override _meta = META;

  override async create(data: Profile): Promise<Profile> {
    const profiles = new ProfileStore(this.kv);
    const providers: Providers = await new ProviderStore(this.kv).list();
    for (const name of data.providers) {
      if (!providers[name])
        throw new InputValidationException(`Provider not found: ${name}`);
    }
    return await profiles.create(data);
  }
}

export class ReadProfile extends ReadEndpoint {
  static override method: RequestMethod = "get";
  static override path: string = "/api/profiles/:id";

  override schema = {
    tags: ["Profiles"],
    summary: "Read Profile",
  } satisfies OpenAPIRouteSchema;

  override _meta = META;

  override async fetch(filters: ListFilters): Promise<Profile | null> {
    return filterProfile(this, filters);
  }
}

export class DeleteProfile extends DeleteEndpoint {
  static override method: RequestMethod = "delete";
  static override path: string = "/api/profiles/:id";

  override schema = {
    tags: ["Profiles"],
    summary: "Delete Profile",
  } satisfies OpenAPIRouteSchema;

  override _meta = META;

  override async getObject(filters: Filters): Promise<Profile | null> {
    return filterProfile(this, filters);
  }

  override async delete(
    oldObj: Profile,
    _filters: Filters,
  ): Promise<Profile | null> {
    const store = new ProfileStore(this.kv);
    return await store.delete(oldObj.id);
  }
}

export class ListProfiles extends ListEndpoint {
  static override method: RequestMethod = "get";
  static override path: string = "/api/profiles";

  override schema = {
    tags: ["Profiles"],
    summary: "List Profiles",
  } satisfies OpenAPIRouteSchema;

  override _meta = META;

  override async list(filters: ListFilters): Promise<ListResult<Profile>> {
    if (filters.filters.length > 0) throw new InputValidationException();
    const store: ProfileStore = new ProfileStore(this.kv);
    const profiles: Profiles = await store.list();
    const result: Profile[] = Object.values(profiles);
    return { result };
  }
}

async function filterProfile(
  self: OpenAPIRoute,
  filters: Filters,
): Promise<Profile | null> {
  if (filters.filters.length !== 1) throw new InputValidationException();
  const filter: FilterCondition = filters.filters[0]!;
  if (
    filter.field !== "id" ||
    typeof filter.value !== "string" ||
    filter.operator !== "EQ"
  )
    throw new InputValidationException();
  const id: string = filter.value;
  const store: ProfileStore = new ProfileStore(self.kv);
  return await store.read(id);
}
