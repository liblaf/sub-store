import fs from "node:fs/promises";
import path from "node:path";

import { TOML } from "bun";
import { userConfigDir } from "platformdirs";
import { z } from "zod";

import type { PublishOptions } from "@/lib/publish";

const CONFIG_SCHEMA = z.strictObject({
  token: z.string().trim().min(1).optional(),
  "base-url": z.string().trim().min(1).optional(),
});

export class CliConfigError extends Error {}

type ConfigEnvironment = Readonly<Record<string, string | undefined>>;

export function subStoreConfigDir(env: ConfigEnvironment = process.env): string {
  const xdg = env.XDG_CONFIG_HOME;
  return xdg && path.isAbsolute(xdg) ? path.join(xdg, "sub-store") : userConfigDir("sub-store");
}

/** Resolve upload settings without exposing configuration values in diagnostics. */
export async function resolvePublishConfig(
  options: { configPath?: string; env?: ConfigEnvironment } = {},
): Promise<PublishOptions> {
  const env = options.env ?? process.env;
  const configPath = options.configPath ?? path.join(subStoreConfigDir(env), "config.toml");
  let text: string | undefined;
  try {
    text = await fs.readFile(configPath, "utf8");
  } catch (error) {
    if (options.configPath !== undefined || (error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new CliConfigError("Failed to read configuration file");
    }
  }

  let parsed: unknown = {};
  if (text !== undefined) {
    try {
      parsed = TOML.parse(text);
    } catch {
      throw new CliConfigError("Invalid TOML configuration");
    }
  }
  const result = CONFIG_SCHEMA.safeParse(parsed);
  if (!result.success) throw new CliConfigError("Invalid configuration options");
  const config = result.data;
  if (config["base-url"] !== undefined) validateBaseUrl(config["base-url"]);

  const token = env.SUB_STORE_API_TOKEN ?? config.token;
  if (!token?.trim()) {
    throw new CliConfigError(
      "An upload token is required; set token in config.toml or SUB_STORE_API_TOKEN",
    );
  }
  const url = env.SUB_STORE_URL ?? config["base-url"] ?? "https://subs.liblaf.me";
  validateBaseUrl(url);
  return { token: token.trim(), url };
}

function validateBaseUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CliConfigError("Invalid publish base URL");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    !(url.protocol === "https:" || (local && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new CliConfigError("Invalid publish base URL");
  }
}
