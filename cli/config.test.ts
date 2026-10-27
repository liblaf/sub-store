import { afterEach, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { CliConfigError, resolvePublishConfig } from "@/cli/config";

const directories: string[] = [];

async function temporaryConfig(source?: string): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sub-store-config-test-"));
  directories.push(directory);
  const configPath = path.join(directory, "config.toml");
  if (source !== undefined) await fs.writeFile(configPath, source);
  return configPath;
}

afterEach(async (): Promise<void> => {
  await Promise.all(
    directories.splice(0).map((directory) => fs.rm(directory, { recursive: true })),
  );
});

test("publish settings load native TOML and retain the default service origin", async (): Promise<void> => {
  const configPath = await temporaryConfig('token = "config-token"\n');
  expect(await resolvePublishConfig({ configPath, env: {} })).toEqual({
    token: "config-token",
    url: "https://subs.liblaf.me",
  });
});

test("publish settings discover the config under the injected XDG config directory", async (): Promise<void> => {
  const configPath = await temporaryConfig();
  const configHome = path.dirname(configPath);
  await fs.mkdir(path.join(configHome, "sub-store"));
  await fs.writeFile(
    path.join(configHome, "sub-store", "config.toml"),
    'token = "xdg-token"\nbase-url = "https://config.example.test"\n',
  );
  expect(await resolvePublishConfig({ env: { XDG_CONFIG_HOME: configHome } })).toEqual({
    token: "xdg-token",
    url: "https://config.example.test",
  });
});

test("environment settings override TOML token and service origin", async (): Promise<void> => {
  const configPath = await temporaryConfig(
    'token = "config-token"\nbase-url = "https://config.example.test"\n',
  );
  expect(
    await resolvePublishConfig({
      configPath,
      env: { SUB_STORE_API_TOKEN: "environment-token", SUB_STORE_URL: "http://127.0.0.1:43123" },
    }),
  ).toEqual({ token: "environment-token", url: "http://127.0.0.1:43123" });
});

test("missing default config permits environment-only operation", async (): Promise<void> => {
  const configPath = await temporaryConfig();
  expect(
    await resolvePublishConfig({
      env: { XDG_CONFIG_HOME: path.dirname(configPath), SUB_STORE_API_TOKEN: "environment-token" },
    }),
  ).toEqual({ token: "environment-token", url: "https://subs.liblaf.me" });
});

test("an explicitly selected missing config fails even with an environment token", async (): Promise<void> => {
  const configPath = await temporaryConfig();
  await expect(
    resolvePublishConfig({ configPath, env: { SUB_STORE_API_TOKEN: "environment-token" } }),
  ).rejects.toBeInstanceOf(CliConfigError);
});

test("missing upload token reports a config error", async (): Promise<void> => {
  const configPath = await temporaryConfig("");
  await expect(resolvePublishConfig({ configPath, env: {} })).rejects.toBeInstanceOf(
    CliConfigError,
  );
});

for (const url of [
  "https://config.example.test",
  "http://localhost:43123",
  "http://127.0.0.1:43123",
  "http://[::1]:43123",
]) {
  test(`publish configuration accepts origin ${url}`, async (): Promise<void> => {
    const configPath = await temporaryConfig(
      `token = "config-token"\nbase-url = ${JSON.stringify(url)}\n`,
    );
    expect(await resolvePublishConfig({ configPath, env: {} })).toEqual({
      token: "config-token",
      url,
    });
  });
}

for (const [index, source] of [
  'token = "private-config-secret',
  "token = 123\n",
  'token = "   "\n',
  'token = "private-config-secret"\nbase-url = 123\n',
  'token = "private-config-secret"\nunrecognized = "private-config-secret"\n',
  'token = "private-config-secret"\nbase-url = "http://public.example.test"\n',
  'token = "private-config-secret"\nbase-url = "https://user:private-config-secret@example.test"\n',
  'token = "private-config-secret"\nbase-url = "https://example.test/path/private-config-secret"\n',
  'token = "private-config-secret"\nbase-url = "https://example.test?token=private-config-secret"\n',
  'token = "private-config-secret"\nbase-url = "https://example.test#private-config-secret"\n',
].entries()) {
  test(`invalid config fails safely (case ${index + 1})`, async (): Promise<void> => {
    const configPath = await temporaryConfig(source);
    let error: unknown;
    try {
      await resolvePublishConfig({ configPath, env: {} });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(CliConfigError);
    expect([
      "Invalid TOML configuration",
      "Invalid configuration options",
      "Invalid publish base URL",
      "An upload token is required; set token in config.toml or SUB_STORE_API_TOKEN",
    ]).toContain((error as Error).message);
    expect(String(error)).not.toContain("private-config-secret");
    expect(String(error)).not.toContain(source);
  });
}

test("invalid environment origins fail safely", async (): Promise<void> => {
  const configPath = await temporaryConfig('token = "config-token"\n');
  await expect(
    resolvePublishConfig({
      configPath,
      env: { SUB_STORE_URL: "https://user:private-environment-secret@example.test" },
    }),
  ).rejects.toBeInstanceOf(CliConfigError);
});
