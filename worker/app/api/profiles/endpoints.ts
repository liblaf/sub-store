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
import { getProfiles, putProfiles } from "./_kv";
import type { Profile, Profiles } from "./_schema";
import { PROFILE_SCHEMA } from "./_schema";

export const META = {
  model: {
    tableName: "profiles",
    primaryKeys: ["id"],
    schema: PROFILE_SCHEMA,
  },
} satisfies MetaInput;

export class CreateProfile extends CreateEndpoint {
  static method: RequestMethod = "post";
  static path: string = "/api/profiles/:id";

  override schema = {
    tags: ["Profiles"],
    summary: "Create Profile",
  } satisfies OpenAPIRouteSchema;

  override _meta = META;

  override async create(data: Profile): Promise<Profile> {
    const c: Context = getContext(this);
    const kv: KVNamespace = env(c).SUB;
    const profiles: Profiles = await getProfiles(kv);
    profiles[data.id] = data;
    await putProfiles(kv, profiles);
    return data;
  }
}

export class ReadProfile extends ReadEndpoint {
  static method: RequestMethod = "get";
  static path: string = "/api/profiles/:id";

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
  static method: RequestMethod = "delete";
  static path: string = "/api/profiles/:id";

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
    const c: Context = getContext(this);
    const kv: KVNamespace = env(c).SUB;
    const profiles: Profiles = await getProfiles(kv);
    delete profiles[oldObj.id];
    await putProfiles(kv, profiles);
    return oldObj;
  }
}

export class ListProfiles extends ListEndpoint {
  static method: RequestMethod = "get";
  static path: string = "/api/profiles";

  override schema = {
    tags: ["Profiles"],
    summary: "List Profiles",
  } satisfies OpenAPIRouteSchema;

  override _meta = META;

  override async list(filters: ListFilters): Promise<ListResult<Profile>> {
    if (filters.filters.length > 0) throw new InputValidationException();
    const c: Context = getContext(this);
    const kv: KVNamespace = env(c).SUB;
    const profiles: Profiles = await getProfiles(kv);
    const result: Profile[] = Object.values(profiles);
    return { result };
  }
}

async function filterProfile(
  endpoint: OpenAPIRoute,
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
  const c: Context = getContext(endpoint);
  const kv: KVNamespace = env(c).SUB;
  const profiles: Profiles = await getProfiles(kv);
  return profiles[id] ?? null;
}
