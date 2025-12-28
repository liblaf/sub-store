import type { FilterCondition, Filters } from "chanfana";
import { InputValidationException } from "chanfana";
import { ArtifactStore } from "./artifact";

export class ConfigStore<T> {
  constructor(
    private kv: KVNamespace,
    private key: string,
  ) {}

  get artifacts(): ArtifactStore {
    return new ArtifactStore(this.kv, this.key);
  }

  async create(id: string, value: T): Promise<T> {
    const data: Record<string, T> = await this.list();
    data[id] = value;
    await this.put(data);
    return value;
  }

  async read(id: string): Promise<T | null> {
    const value: Record<string, T> = await this.list();
    return value[id] ?? null;
  }

  async delete(id: string): Promise<T | null> {
    const data: Record<string, T> = await this.list();
    const value: T | undefined = data[id];
    if (value === undefined) return null;
    await this.artifacts.clear(id);
    delete data[id];
    await this.put(data);
    return value;
  }

  async list(): Promise<Record<string, T>> {
    const data: Record<string, T> | null = await this.kv.get(this.key, "json");
    return data ?? {};
  }

  async filter(filters: Filters): Promise<T | null> {
    const data: Record<string, T> = await this.list();
    if (filters.filters.length !== 1) throw new InputValidationException();
    const filter: FilterCondition = filters.filters[0]!;
    if (
      filter.field !== "id" ||
      typeof filter.value !== "string" ||
      filter.operator !== "EQ"
    )
      throw new InputValidationException();
    const id: string = filter.value;
    return data[id] ?? null;
  }

  protected async put(data: Record<string, T>): Promise<void> {
    const value: string = JSON.stringify(data);
    const old: string | null = await this.kv.get(this.key);
    if (value === old) return;
    await this.kv.put(this.key, value);
  }
}
