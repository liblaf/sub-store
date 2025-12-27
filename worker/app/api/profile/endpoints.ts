import type { Profile, Profiles } from "@worker/kv/profile";
import { PROFILE_SCHEMA, ProfileStore } from "@worker/kv/profile";
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
    tableName: "profiles",
    primaryKeys: ["id"],
    schema: PROFILE_SCHEMA,
  },
} satisfies MetaInput;

export class CreateProfile extends CreateEndpoint {
  static method: RequestMethod = "post";
  static path: string = "/api/profile/:id";

  override schema = {
    tags: ["Profiles"],
    summary: "Create Profile",
  } satisfies OpenAPIRouteSchema;

  override _meta = META;

  override async create(data: Profile): Promise<Profile> {
    const profiles = new ProfileStore(this.kv);
    return await profiles.create(data.id, data);
  }
}

export class ReadProfile extends ReadEndpoint {
  static method: RequestMethod = "get";
  static path: string = "/api/profile/:id";

  override schema = {
    tags: ["Profiles"],
    summary: "Read Profile",
  } satisfies OpenAPIRouteSchema;

  override _meta = META;

  override async fetch(filters: ListFilters): Promise<Profile | null> {
    const store = new ProfileStore(this.kv);
    return await store.filter(filters);
  }
}

export class DeleteProfile extends DeleteEndpoint {
  static method: RequestMethod = "delete";
  static path: string = "/api/profile/:id";

  override schema = {
    tags: ["Profiles"],
    summary: "Delete Profile",
  } satisfies OpenAPIRouteSchema;

  override _meta = META;

  override async getObject(filters: Filters): Promise<Profile | null> {
    const store = new ProfileStore(this.kv);
    return await store.filter(filters);
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
  static method: RequestMethod = "get";
  static path: string = "/api/profile";

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
