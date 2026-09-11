import fs from "node:fs/promises";

import jsone from "json-e";
import type { Country } from "world-countries";
import YAML from "yaml";
import type { ZodType } from "zod";

import { COUNTRY_UNKNOWN } from "../pipeline/infer/country";
import type { ProxyWrapper } from "./proxy";
import { CRYPTO_COUNTRY_CCA2, iconFromCountry } from "./template-country";

export type TemplateTarget = "mihomo" | "stash";

export type TemplateCountry = {
  cca2: string;
  name: string;
  icon: string;
};

export type TemplateTargetProxy<T> = {
  name: string;
  mihomo?: T & { name: string };
  stash?: T & { name: string };
};

export type TemplateProxy<T> = TemplateTargetProxy<T> & {
  country: TemplateCountry;
};

export type TemplateInfoProxy<T> = TemplateTargetProxy<T>;

export type TemplateCountryGroup<T> = TemplateCountry & {
  proxies: TemplateProxy<T>[];
};

export type TemplateVars = Partial<Record<"TS_AUTH_KEY", string>>;

export type TemplateContext<T> = {
  version: 7;
  target: TemplateTarget;
  vars: TemplateVars;
  proxies: TemplateProxy<T>[];
  infoProxies: TemplateInfoProxy<T>[];
  countries: TemplateCountryGroup<T>[];
  CRYPTO_COUNTRIES: string[];
};

type RenderedProxyGroup = {
  name: string;
  proxies: string[];
};

type RenderedConfig = {
  proxies: { name: string }[];
  "proxy-groups": RenderedProxyGroup[];
  rules?: string[];
  "rule-providers"?: Record<string, unknown>;
};

const RULE_TRAILING_OPTIONS = new Set(["no-resolve", "no-track", "src"]);

type RenderTemplateOptions<T extends RenderedConfig> = {
  builtin: {
    url: string;
    value: unknown;
  };
  context: Record<string, unknown>;
  schema: ZodType<T>;
  template: string;
};

export function createTemplateContext<T extends Record<string, unknown>>(
  target: TemplateTarget,
  proxies: ProxyWrapper<T>[],
  infoProxies: ProxyWrapper<T>[],
  vars: TemplateVars = {},
): TemplateContext<T> {
  const templateProxies: TemplateProxy<T>[] = proxies.map(
    (proxy: ProxyWrapper<T>): TemplateProxy<T> => ({
      ...templateTargetProxy(target, proxy),
      country: templateCountry(proxy.country),
    }),
  );
  const templateInfoProxies: TemplateInfoProxy<T>[] = infoProxies.map(
    (proxy: ProxyWrapper<T>): TemplateInfoProxy<T> => templateTargetProxy(target, proxy),
  );
  const countries = new Map<string, TemplateCountryGroup<T>>();
  for (const proxy of templateProxies) {
    if (proxy.country.cca2 === COUNTRY_UNKNOWN.cca2) continue;
    const country: TemplateCountryGroup<T> = countries.get(proxy.country.cca2) ?? {
      ...proxy.country,
      proxies: [],
    };
    country.proxies.push(proxy);
    countries.set(proxy.country.cca2, country);
  }
  return {
    version: 7,
    target,
    vars,
    proxies: templateProxies,
    infoProxies: templateInfoProxies,
    countries: [...countries.values()].sort(
      (a: TemplateCountryGroup<T>, b: TemplateCountryGroup<T>): number =>
        b.proxies.length - a.proxies.length,
    ),
    CRYPTO_COUNTRIES: [...CRYPTO_COUNTRY_CCA2],
  };
}

function templateTargetProxy<T extends Record<string, unknown>>(
  target: TemplateTarget,
  proxy: ProxyWrapper<T>,
): TemplateTargetProxy<T> {
  return {
    name: proxy.pretty,
    [target]: {
      ...proxy.wrapped,
      name: proxy.pretty,
    },
  } as TemplateTargetProxy<T>;
}

function templateCountry(country: Country): TemplateCountry {
  return {
    cca2: country.cca2,
    name: country.name.common,
    icon: iconFromCountry(country),
  };
}

export async function renderTemplate<T extends RenderedConfig>(
  options: RenderTemplateOptions<T>,
): Promise<string> {
  const template: unknown =
    options.template === options.builtin.url
      ? options.builtin.value
      : YAML.parse(await fs.readFile(options.template, "utf-8"), { merge: true });
  const rendered: unknown = jsone(template as Record<string, unknown>, options.context);
  const config: T = options.schema.parse(removePrivateFields(rendered));
  const postprocessed: T = removeEmptyProxyGroups(config);
  assertReferencesExist(postprocessed);
  const validated: T = options.schema.parse(postprocessed);
  return YAML.stringify(validated, { aliasDuplicateObjects: false });
}

function removePrivateFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removePrivateFields);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]: [string, unknown]): boolean => !key.startsWith("__"))
      .map(([key, child]: [string, unknown]): [string, unknown] => [
        key,
        removePrivateFields(child),
      ]),
  );
}

function removeEmptyProxyGroups<T extends RenderedConfig>(config: T): T {
  let groups: RenderedProxyGroup[] = config["proxy-groups"];
  const removedNames = new Set<string>();

  while (true) {
    const emptyNames = new Set(
      groups
        .filter((group: RenderedProxyGroup): boolean => group.proxies.length === 0)
        .map((group: RenderedProxyGroup): string => group.name),
    );
    if (emptyNames.size === 0) break;
    for (const name of emptyNames) removedNames.add(name);
    groups = groups
      .filter((group: RenderedProxyGroup): boolean => !emptyNames.has(group.name))
      .map((group: RenderedProxyGroup): RenderedProxyGroup => ({
        ...group,
        proxies: group.proxies.filter((name: string): boolean => !emptyNames.has(name)),
      }));
  }

  return {
    ...config,
    "proxy-groups": groups,
    ...(config.rules
      ? {
          rules: config.rules.filter(
            (rule: string): boolean => !ruleTargetsAnyGroup(rule, removedNames),
          ),
        }
      : {}),
  };
}

function ruleTargetsAnyGroup(rule: string, groupNames: Set<string>): boolean {
  const target: string | undefined = ruleTarget(rule.split(","));
  return target !== undefined && groupNames.has(target);
}

function assertReferencesExist(config: RenderedConfig): void {
  const targets = new Set([
    "COMPATIBLE",
    "DIRECT",
    "GLOBAL",
    "PASS",
    "PASS-RULE",
    "REJECT",
    "REJECT-DROP",
  ]);
  for (const proxy of config.proxies) addUnique(targets, proxy.name, "proxy or group");
  for (const group of config["proxy-groups"]) addUnique(targets, group.name, "proxy or group");

  for (const group of config["proxy-groups"]) {
    for (const member of group.proxies) {
      if (!targets.has(member)) {
        throw new Error(
          `Proxy group ${group.name} references an unknown proxy or group: ${member}`,
        );
      }
    }
  }

  for (const rule of config.rules ?? []) {
    const fields: string[] = rule.split(",");
    const type: string | undefined = fields[0]?.trim();
    const provider: string | undefined = fields[1]?.trim();
    if (type === "RULE-SET" && (!provider || !config["rule-providers"]?.[provider])) {
      throw new Error(`Rule references an unknown rule provider: ${provider}`);
    }
    const target: string | undefined = ruleTarget(fields);
    if (target && !targets.has(target)) {
      throw new Error(`Rule references an unknown proxy or group: ${target}`);
    }
  }
}

function ruleTarget(fields: string[]): string | undefined {
  // Mihomo SUB-RULE ends with a sub-rule name instead of an outbound policy.
  const type: string | undefined = fields[0]?.trim();
  if (type === "SUB-RULE") return undefined;
  let index: number = fields.length - 1;
  const minimumIndex: number = type === "MATCH" ? 1 : 2;
  while (index > minimumIndex && RULE_TRAILING_OPTIONS.has(fields[index]!.trim())) index--;
  return fields[index]?.trim();
}

function addUnique(names: Set<string>, name: string, kind: string): void {
  if (names.has(name)) throw new Error(`Duplicate ${kind} name: ${name}`);
  names.add(name);
}
