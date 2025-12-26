import * as chanfana from "chanfana";
import type * as hono from "hono";
import { env } from "hono/adapter";

export type Context = hono.Context<{ Bindings: CloudflareBindings }>;

export type RequestMethod = "get" | "delete" | "patch" | "post" | "put";

export interface RouteOptions {
  method: RequestMethod;
  path: string;
}

export class OpenAPIRoute extends chanfana.OpenAPIRoute<[Context]> {
  static method: RequestMethod;
  static path: string;
  get ctx(): Context {
    return this.args[0];
  }
  get kv(): KVNamespace {
    return env(this.ctx).SUB;
  }
}

export class CreateEndpoint extends chanfana.CreateEndpoint<[Context]> {
  static method: RequestMethod;
  static path: string;
  get ctx(): Context {
    return this.args[0];
  }
  get kv(): KVNamespace {
    return env(this.ctx).SUB;
  }
}

export class ReadEndpoint extends chanfana.ReadEndpoint<[Context]> {
  static method: RequestMethod;
  static path: string;
  get ctx(): Context {
    return this.args[0];
  }
  get kv(): KVNamespace {
    return env(this.ctx).SUB;
  }
}

export class UpdateEndpoint extends chanfana.UpdateEndpoint<[Context]> {
  static method: RequestMethod;
  static path: string;
  get ctx(): Context {
    return this.args[0];
  }
  get kv(): KVNamespace {
    return env(this.ctx).SUB;
  }
}

export class DeleteEndpoint extends chanfana.DeleteEndpoint<[Context]> {
  static method: RequestMethod;
  static path: string;
  get ctx(): Context {
    return this.args[0];
  }
  get kv(): KVNamespace {
    return env(this.ctx).SUB;
  }
}

export class ListEndpoint extends chanfana.ListEndpoint<[Context]> {
  static method: RequestMethod;
  static path: string;
  get ctx(): Context {
    return this.args[0];
  }
  get kv(): KVNamespace {
    return env(this.ctx).SUB;
  }
}
