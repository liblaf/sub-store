import YAML from "yaml";
import type { ZodType } from "zod";

import { compilePattern } from "./filter";
import type { Profile } from "./profile";

export type NativeProxy = { name: string; type: string; [key: string]: unknown };
type NativeGroup = { name: string; proxies: string[]; [key: string]: unknown };
type NativeConfig = {
  proxies: NativeProxy[];
  "proxy-groups": NativeGroup[];
  rules?: string[];
  "rule-providers"?: Record<string, unknown>;
  [key: string]: unknown;
};

const BUILTIN_TARGETS = new Set([
  "COMPATIBLE",
  "DIRECT",
  "GLOBAL",
  "PASS",
  "PASS-RULE",
  "REJECT",
  "REJECT-DROP",
]);
const RULE_TRAILING_OPTIONS = new Set(["no-resolve", "no-track", "src"]);
const GROUP_BUILD_FIELDS = new Set([
  "use",
  "filter",
  "exclude-filter",
  "exclude-type",
  "include-all",
  "include-all-proxies",
  "include-all-providers",
]);

/** Expand provider references into explicit members while retaining nested groups. */
export function compileProfile(
  profile: Profile,
  providers: ReadonlyMap<string, NativeProxy[]>,
  infoProxies: NativeProxy[],
): NativeConfig {
  const providerNames = Object.keys(profile["proxy-providers"]);
  for (const name of providerNames) {
    if (!providers.has(name)) throw new Error(`Missing provider snapshot: ${name}`);
  }
  for (const name of providers.keys()) {
    if (!Object.hasOwn(profile["proxy-providers"], name)) {
      throw new Error(`Undeclared provider snapshot: ${name}`);
    }
  }
  const allProviderProxies = providerNames.flatMap((name) => providers.get(name)!);
  const proxies = [...profile.proxies, ...allProviderProxies, ...infoProxies];
  const groupNames = new Set<string>();
  const targets = new Set(BUILTIN_TARGETS);
  for (const proxy of proxies) addUnique(targets, proxy.name);
  for (const group of profile["proxy-groups"]) {
    addUnique(targets, group.name);
    groupNames.add(group.name);
  }
  for (const name of providerNames) {
    if (targets.has(name))
      throw new Error(`Provider name conflicts with a proxy or group: ${name}`);
  }

  const groups: NativeGroup[] = profile["proxy-groups"].map((group) => {
    const names = [...group.proxies];
    const include = group.filter === undefined ? undefined : compilePattern(group.filter);
    const exclude =
      group["exclude-filter"] === undefined ? undefined : compilePattern(group["exclude-filter"]);
    const excludedTypes = new Set(
      (group["exclude-type"] ?? "")
        .split("|")
        .filter(Boolean)
        .map((type) => type.toLowerCase()),
    );
    const append = (entries: NativeProxy[]): void => {
      for (const proxy of entries) {
        if (include && !include.test(proxy.name)) continue;
        if (exclude?.test(proxy.name) || excludedTypes.has(proxy.type.toLowerCase())) continue;
        names.push(proxy.name);
      }
    };
    for (const name of group.use) {
      if (name === "$info") append(infoProxies);
      else if (providers.has(name)) append(providers.get(name)!);
      else if (groupNames.has(name)) names.push(name);
      else throw new Error(`Proxy group ${group.name} references an unknown use source: ${name}`);
    }
    if (group["include-all"] || group["include-all-proxies"]) append(profile.proxies);
    if (group["include-all"] || group["include-all-providers"]) append(allProviderProxies);
    return {
      ...Object.fromEntries(Object.entries(group).filter(([key]) => !GROUP_BUILD_FIELDS.has(key))),
      name: group.name,
      proxies: [...new Set(names)],
    };
  });

  const config = removePrivateFields({
    ...Object.fromEntries(
      Object.entries(profile).filter(([key]) => key !== "sub-store" && key !== "proxy-providers"),
    ),
    proxies,
    "proxy-groups": groups,
  }) as NativeConfig;
  applyEmptyFallbacks(config);
  assertReferencesExist(config);
  assertAcyclicOutbounds(config);
  const postprocessed = removeEmptyProxyGroups(config);
  assertReferencesExist(postprocessed);
  assertAcyclicOutbounds(postprocessed);
  return postprocessed;
}

export function renderProfile<T>(options: {
  profile: Profile;
  providers: ReadonlyMap<string, NativeProxy[]>;
  infoProxies: NativeProxy[];
  schema: ZodType<T>;
}): string {
  const config = compileProfile(options.profile, options.providers, options.infoProxies);
  return YAML.stringify(options.schema.parse(config), { aliasDuplicateObjects: false });
}

function removePrivateFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removePrivateFields);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !key.startsWith("__"))
      .map(([key, child]) => [key, removePrivateFields(child)]),
  );
}

function applyEmptyFallbacks(config: NativeConfig): void {
  const proxies = new Set([...BUILTIN_TARGETS, ...config.proxies.map((proxy) => proxy.name)]);
  proxies.delete("GLOBAL");
  for (const group of config["proxy-groups"]) {
    const fallback = group["empty-fallback"];
    if (fallback === undefined) continue;
    if (typeof fallback !== "string" || !proxies.has(fallback)) {
      throw new Error(`Proxy group ${group.name} has an invalid empty-fallback proxy`);
    }
    if (group.proxies.length === 0) group.proxies = [fallback];
  }
}

function removeEmptyProxyGroups(config: NativeConfig): NativeConfig {
  let groups = config["proxy-groups"];
  while (true) {
    applyEmptyFallbacks({ ...config, "proxy-groups": groups });
    const emptyNames = new Set(
      groups.filter((group) => !group.proxies.length).map((group) => group.name),
    );
    if (!emptyNames.size) break;
    for (const rule of config.rules ?? []) {
      const target = ruleTarget(rule.split(","));
      if (target && emptyNames.has(target)) {
        throw new Error(`Routing rule targets an empty proxy group: ${target}`);
      }
    }
    groups = groups
      .filter((group) => !emptyNames.has(group.name))
      .map((group) => ({
        ...group,
        proxies: group.proxies.filter((name) => !emptyNames.has(name)),
      }));
  }
  return { ...config, "proxy-groups": groups };
}

function assertReferencesExist(config: NativeConfig): void {
  const targets = new Set(BUILTIN_TARGETS);
  for (const proxy of config.proxies) addUnique(targets, proxy.name);
  for (const group of config["proxy-groups"]) addUnique(targets, group.name);
  for (const group of config["proxy-groups"]) {
    for (const member of group.proxies) {
      if (!targets.has(member)) {
        throw new Error(
          `Proxy group ${group.name} references an unknown proxy or group: ${member}`,
        );
      }
    }
  }
  for (const proxy of config.proxies) {
    const dialer = proxy["dialer-proxy"];
    if (dialer !== undefined && (typeof dialer !== "string" || !targets.has(dialer))) {
      throw new Error(`Proxy ${proxy.name} references an unknown dialer proxy`);
    }
  }
  for (const rule of config.rules ?? []) {
    const fields = rule.split(",");
    const type = fields[0]?.trim();
    const provider = fields[1]?.trim();
    if (
      type === "RULE-SET" &&
      (!provider || !Object.hasOwn(config["rule-providers"] ?? {}, provider))
    ) {
      throw new Error(`Rule references an unknown rule provider: ${provider}`);
    }
    const target = ruleTarget(fields);
    if (target && !targets.has(target))
      throw new Error(`Rule references an unknown proxy or group: ${target}`);
  }
}

function assertAcyclicOutbounds(config: NativeConfig): void {
  const edges = new Map(config["proxy-groups"].map((group) => [group.name, group.proxies]));
  for (const proxy of config.proxies) {
    edges.set(proxy.name, typeof proxy["dialer-proxy"] === "string" ? [proxy["dialer-proxy"]] : []);
  }
  const active = new Set<string>();
  const complete = new Set<string>();
  const visit = (name: string): void => {
    if (complete.has(name)) return;
    if (active.has(name)) throw new Error(`Circular proxy or group reference: ${name}`);
    active.add(name);
    for (const member of edges.get(name)!) if (edges.has(member)) visit(member);
    active.delete(name);
    complete.add(name);
  };
  for (const name of edges.keys()) visit(name);
}

function ruleTarget(fields: string[]): string | undefined {
  const type = fields[0]?.trim();
  if (type === "SUB-RULE") return undefined;
  let index = fields.length - 1;
  const minimumIndex = type === "MATCH" ? 1 : 2;
  while (index > minimumIndex && RULE_TRAILING_OPTIONS.has(fields[index]!.trim())) index--;
  return fields[index]?.trim();
}

function addUnique(names: Set<string>, name: string): void {
  if (names.has(name)) throw new Error(`Duplicate proxy or group name: ${name}`);
  names.add(name);
}
