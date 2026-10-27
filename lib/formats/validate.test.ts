import { describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { which } from "bun";
import YAML from "yaml";

import { PROFILE_SCHEMA } from "@/lib/core/profile";
import { renderProfile } from "@/lib/core/template";

import { MIHOMO_CONFIG_SCHEMA } from "./mihomo/schema";
import { validateWithMihomo } from "./validate";

const nativeMihomo = which("mihomo");

async function withFakeMihomo(script: string, check: (directory: string) => Promise<void>) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sub-store-validator-test-"));
  const previousPath = process.env.PATH;
  try {
    await fs.writeFile(path.join(directory, "mihomo"), `#!/bin/sh\n${script}\n`, { mode: 0o700 });
    process.env.PATH = `${directory}:${previousPath ?? ""}`;
    await check(directory);
  } finally {
    process.env.PATH = previousPath;
    await fs.rm(directory, { recursive: true, force: true });
  }
}

describe("native Mihomo validation", () => {
  test("withholds sensitive diagnostics and removes the private temporary configuration", async () => {
    await withFakeMihomo(
      'printf "%s\\n" "$4" > "$(dirname "$0")/config-path"\nstat -c %a "$4" > "$(dirname "$0")/mode"\nprintf "credential-from-config" >&2\nexit 1',
      async (directory) => {
        let failure: unknown;
        try {
          await validateWithMihomo("password: credential-from-config\n");
        } catch (error) {
          failure = error;
        }
        expect(failure).toBeInstanceOf(Error);
        expect(String(failure)).toContain("mihomo -t locally");
        expect(String(failure)).not.toContain("credential-from-config");
        expect((failure as Error).cause).toBeUndefined();
        expect((await fs.readFile(path.join(directory, "mode"), "utf8")).trim()).toBe("600");
        const config = (await fs.readFile(path.join(directory, "config-path"), "utf8")).trim();
        expect(await fs.exists(path.dirname(config))).toBe(false);
      },
    );
  });

  test("bounds excessive native output and cleans up after terminating the validator", async () => {
    await withFakeMihomo(
      'printf "%s\\n" "$4" > "$(dirname "$0")/config-path"\nexec yes credential-from-config',
      async (directory) => {
        await expect(validateWithMihomo("{}\n")).rejects.toThrow("1 MiB limit");
        const config = (await fs.readFile(path.join(directory, "config-path"), "utf8")).trim();
        expect(await fs.exists(path.dirname(config))).toBe(false);
      },
    );
  });

  test.skipIf(!nativeMihomo)(
    "accepts an offline compiled profile with YAML anchors and native settings",
    async () => {
      const profile = PROFILE_SCHEMA.parse(
        YAML.parse(
          `
mixed-port: 17890
mode: rule
ipv6: false
dns:
  enable: false
proxies:
  - name: Local
    type: direct
proxy-providers: {}
proxy-groups:
  - &selection
    name: PROXY
    type: select
    proxies: [Local]
    icon: https://example.invalid/icon.png
  - <<: *selection
    name: Backup
  - name: Empty
    type: select
    empty-fallback: REJECT
rules:
  - MATCH,PROXY
`,
          { merge: true },
        ),
      );
      const body = await renderProfile({
        profile,
        providers: new Map(),
        infoProxies: [],
        schema: MIHOMO_CONFIG_SCHEMA,
      });
      const config = YAML.parse(body);
      expect(config["mixed-port"]).toBe(17890);
      expect(config.dns).toEqual({ enable: false });
      expect(config["proxy-groups"][1]).toMatchObject({
        name: "Backup",
        type: "select",
        proxies: ["Local"],
        icon: "https://example.invalid/icon.png",
      });
      expect(config).not.toHaveProperty("proxy-providers");
      expect(config["proxy-groups"][2]).toEqual({
        name: "Empty",
        type: "select",
        proxies: ["REJECT"],
        "empty-fallback": "REJECT",
      });
      await validateWithMihomo(body);
    },
  );
});
