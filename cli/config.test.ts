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

test("publish settings load the publish table and retain the default service origin", async (): Promise<void> => {
  const configPath = await temporaryConfig('[publish]\ntoken = " config-token "\n');
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
    '[publish]\ntoken = "xdg-token"\nbase-url = "https://config.example.test"\n',
  );
  expect(await resolvePublishConfig({ env: { XDG_CONFIG_HOME: configHome } })).toEqual({
    token: "xdg-token",
    url: "https://config.example.test",
  });
});

test("credential environment variables do not override the TOML settings", async (): Promise<void> => {
  const configPath = await temporaryConfig(
    '[publish]\ntoken = "config-token"\nbase-url = "https://config.example.test"\n',
  );
  expect(
    await resolvePublishConfig({
      configPath,
      env: {
        SUB_STORE_API_TOKEN: "environment-token",
        SUB_STORE_URL: "https://user:private-environment-secret@example.test",
      },
    }),
  ).toEqual({
    token: "config-token",
    url: "https://config.example.test",
  });
});

test("missing default config fails even with environment credentials", async (): Promise<void> => {
  const configPath = await temporaryConfig();
  await expect(
    resolvePublishConfig({
      env: { XDG_CONFIG_HOME: path.dirname(configPath), SUB_STORE_API_TOKEN: "environment-token" },
    }),
  ).rejects.toThrow("Failed to read configuration file");
});

test("an explicitly selected missing config fails even with an environment token", async (): Promise<void> => {
  const configPath = await temporaryConfig();
  await expect(
    resolvePublishConfig({ configPath, env: { SUB_STORE_API_TOKEN: "environment-token" } }),
  ).rejects.toBeInstanceOf(CliConfigError);
});

for (const url of [
  "https://config.example.test",
  "http://localhost:43123",
  "http://127.0.0.1:43123",
  "http://[::1]:43123",
]) {
  test(`publish configuration accepts origin ${url}`, async (): Promise<void> => {
    const configPath = await temporaryConfig(
      `[publish]\ntoken = "config-token"\nbase-url = ${JSON.stringify(url)}\n`,
    );
    expect(await resolvePublishConfig({ configPath, env: {} })).toEqual({
      token: "config-token",
      url,
    });
  });
}

for (const [index, source] of [
  '[publish]\ntoken = "private-config-secret',
  "",
  'token = "private-config-secret"\n',
  "[publish]\ntoken = 123\n",
  '[publish]\ntoken = "   "\n',
  '[publish]\nbase-url = "https://config.example.test"\n',
  '[publish]\ntoken = "private-config-secret"\nbase-url = 123\n',
  'unrecognized = "private-config-secret"\n[publish]\ntoken = "config-token"\n',
  '[publish]\ntoken = "private-config-secret"\nunrecognized = "private-config-secret"\n',
  '[publish]\ntoken = "private-config-secret"\nbase-url = "http://public.example.test"\n',
  '[publish]\ntoken = "private-config-secret"\nbase-url = "https://user:private-config-secret@example.test"\n',
  '[publish]\ntoken = "private-config-secret"\nbase-url = "https://example.test/path/private-config-secret"\n',
  '[publish]\ntoken = "private-config-secret"\nbase-url = "https://example.test?token=private-config-secret"\n',
  '[publish]\ntoken = "private-config-secret"\nbase-url = "https://example.test#private-config-secret"\n',
].entries()) {
  test(`invalid config fails safely (case ${index + 1})`, async (): Promise<void> => {
    const configPath = await temporaryConfig(source);
    let error: unknown;
    try {
      await resolvePublishConfig({
        configPath,
        env: { SUB_STORE_API_TOKEN: "environment-token" },
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(CliConfigError);
    expect([
      "Invalid TOML configuration",
      "Invalid configuration options",
      "Invalid publish base URL",
    ]).toContain((error as Error).message);
    expect(String(error)).not.toContain("private-config-secret");
    if (source) expect(String(error)).not.toContain(source);
    expect((error as Error).cause).toBeUndefined();
  });
}
