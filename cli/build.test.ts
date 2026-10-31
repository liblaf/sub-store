import { expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";

import { serve, spawn } from "bun";
import { build } from "bunup";
import YAML from "yaml";

import config from "@/bunup.config";

test("packaged CLI builds native YAML with merge keys into a private artifact", async (): Promise<void> => {
  const root = path.resolve(import.meta.dir, "..");
  await fs.mkdir(path.join(root, "tmp"), { recursive: true });
  const dir = await fs.mkdtemp(path.join(root, "tmp", "cli-test-"));
  let upstreamRequests = 0;
  let uploads = 0;
  const uploadTokens: (string | null)[] = [];
  const server = serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) => {
      if (request.method === "PUT") {
        uploads += 1;
        uploadTokens.push(request.headers.get("authorization"));
        return new Response(null, { status: 204 });
      }
      upstreamRequests += 1;
      return new Response("private upstream response", { status: 403 });
    },
  });
  try {
    const built = await build(
      {
        ...config,
        outDir: path.relative(root, path.join(dir, "dist")),
        dts: false,
        exports: false,
        onSuccess: undefined,
      },
      root,
    );
    const entry = built.files.find(({ kind }) => kind === "entry-point")!;
    const profile = path.join(dir, "profile.yaml");
    const output = path.join(dir, "stash.yaml");
    await fs.writeFile(
      profile,
      `
__sub-store:
  id: 0123456789ABCDEFGHJK
  target: stash
proxies:
  - &base
    name: 节点甲
    type: direct
  - <<: *base
    name: 节点乙
proxy-groups:
  - name: 手动选择
    type: select
    proxies: [节点甲, 节点乙]
rules: ["MATCH,手动选择"]
dns:
  enable: true
  nameserver: [https://dns.example.test/dns-query]
`,
    );
    const child = spawn(
      [process.execPath, entry.fullPath, "build", "stash", profile, "-o", output],
      {
        cwd: root,
        env: { ...process.env, TZ: "UTC", XDG_CACHE_HOME: path.join(dir, "cache") },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect({ exitCode, output: exitCode === 0 ? "" : stdout + stderr }).toEqual({
      exitCode: 0,
      output: "",
    });
    const artifact = YAML.parse(await fs.readFile(output, "utf8"));
    expect(artifact["__sub-store"]).toBeUndefined();
    expect(artifact.proxies).toEqual([
      { name: "节点甲", type: "direct" },
      { name: "节点乙", type: "direct" },
    ]);
    expect(artifact["proxy-groups"]).toEqual([
      { name: "手动选择", type: "select", proxies: ["节点甲", "节点乙"] },
    ]);
    expect(artifact.dns.nameserver).toEqual(["https://dns.example.test/dns-query"]);
    expect((await fs.stat(output)).mode & 0o777).toBe(0o600);
    const previousOutput = await fs.readFile(output, "utf8");
    const smartProfile = path.join(dir, "mihomo-smart.yaml");
    const smartBin = path.join(dir, "bin");
    await fs.mkdir(smartBin);
    await fs.writeFile(
      path.join(smartBin, "mihomo"),
      '#!/bin/sh\nprintf "%s\\n" "$@" > "${0%/*}/arguments"\nwhile IFS= read -r line; do printf "%s\\n" "$line"; done < "$4" > "${0%/*}/checked.yaml"\n',
      { mode: 0o700 },
    );
    await fs.writeFile(
      smartProfile,
      YAML.stringify({
        "__sub-store": { target: "mihomo-smart" },
        "lgbm-auto-update": true,
        "proxy-groups": [{ name: "Smart", type: "smart", proxies: ["DIRECT"], uselightgbm: true }],
        rules: ["MATCH,Smart"],
      }),
    );
    const smartChild = spawn(
      [process.execPath, entry.fullPath, "build", "mihomo-smart", smartProfile],
      {
        cwd: dir,
        env: { ...process.env, PATH: smartBin },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [smartExit, smartStdout, smartStderr] = await Promise.all([
      smartChild.exited,
      new Response(smartChild.stdout).text(),
      new Response(smartChild.stderr).text(),
    ]);
    expect({
      exitCode: smartExit,
      output: smartExit === 0 ? "" : smartStdout + smartStderr,
    }).toEqual({
      exitCode: 0,
      output: "",
    });
    const smartOutput = path.join(dir, "artifacts", "mihomo-smart.yaml");
    const smartBody = await fs.readFile(smartOutput, "utf8");
    expect(YAML.parse(smartBody)).toEqual({
      "lgbm-auto-update": true,
      "proxy-groups": [{ name: "Smart", type: "smart", proxies: ["DIRECT"], uselightgbm: true }],
      rules: ["MATCH,Smart"],
      proxies: [],
    });
    expect(await fs.readFile(path.join(smartBin, "checked.yaml"), "utf8")).toBe(smartBody);
    const smartArgs = (await fs.readFile(path.join(smartBin, "arguments"), "utf8"))
      .trim()
      .split("\n");
    expect(smartArgs).toEqual(["-d", expect.any(String), "-f", expect.any(String), "-t"]);
    expect(await fs.exists(smartArgs[1]!)).toBe(false);
    expect((await fs.stat(smartOutput)).mode & 0o777).toBe(0o600);
    expect((await fs.stat(`${smartOutput}.metadata.json`)).mode & 0o777).toBe(0o600);
    const secret = "private-subscription-token";
    for (const target of ["mihomo", "mihomo-smart", "stash"] as const) {
      await fs.writeFile(
        profile,
        YAML.stringify({
          "__sub-store": {
            id: "0123456789ABCDEFGHJK",
            target: target === "stash" ? "mihomo-smart" : "stash",
          },
          "proxy-providers": {
            upstream: { url: new URL(`/subscription/${secret}`, server.url).href },
          },
        }),
      );
      const mismatched = spawn(
        [process.execPath, entry.fullPath, "build", target, profile, "-o", output],
        { cwd: root, stdout: "pipe", stderr: "pipe" },
      );
      const [mismatchExit, mismatchStdout, mismatchStderr] = await Promise.all([
        mismatched.exited,
        new Response(mismatched.stdout).text(),
        new Response(mismatched.stderr).text(),
      ]);
      expect(mismatchExit).toBe(1);
      if (target !== "stash") expect(mismatchStderr).toContain("mihomo executable");
      expect(mismatchStdout + mismatchStderr).not.toContain(secret);
      expect(upstreamRequests).toBe(0);
      expect(await fs.readFile(output, "utf8")).toBe(previousOutput);
    }
    await fs.writeFile(
      profile,
      YAML.stringify({
        "proxy-providers": {
          upstream: { url: new URL(`/subscription/${secret}`, server.url).href },
        },
      }),
    );
    const failed = spawn(
      [process.execPath, entry.fullPath, "build", "stash", profile, "-o", output],
      {
        cwd: root,
        env: { ...process.env, XDG_CACHE_HOME: path.join(dir, "cache") },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [failedExit, failedStdout, failedStderr] = await Promise.all([
      failed.exited,
      new Response(failed.stdout).text(),
      new Response(failed.stderr).text(),
    ]);
    expect(failedExit).toBe(1);
    expect(failedStderr).toContain("Failed to build Stash configuration");
    expect(failedStdout + failedStderr).not.toContain(secret);
    expect(failedStdout + failedStderr).not.toContain("private upstream response");
    await fs.writeFile(profile, YAML.stringify({ "__sub-store": { id: secret, target: "stash" } }));
    const failedPublish = spawn([process.execPath, entry.fullPath, "publish", profile], {
      cwd: root,
      env: {
        ...process.env,
        XDG_CONFIG_HOME: path.join(dir, "config"),
        SUB_STORE_API_TOKEN: secret,
        SUB_STORE_URL: "https://example.test",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [publishExit, publishStdout, publishStderr] = await Promise.all([
      failedPublish.exited,
      new Response(failedPublish.stdout).text(),
      new Response(failedPublish.stderr).text(),
    ]);
    expect(publishExit).toBe(1);
    expect(publishStderr).toContain("Failed to publish profiles");
    expect(publishStdout + publishStderr).not.toContain(secret);
    const empty = path.join(dir, `empty-${secret}`);
    await fs.mkdir(empty);
    const emptyPublish = spawn([process.execPath, entry.fullPath, "publish", empty], {
      cwd: root,
      env: {
        ...process.env,
        XDG_CONFIG_HOME: path.join(dir, "config"),
        SUB_STORE_API_TOKEN: secret,
        SUB_STORE_URL: "https://example.test",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [emptyExit, emptyStdout, emptyStderr] = await Promise.all([
      emptyPublish.exited,
      new Response(emptyPublish.stdout).text(),
      new Response(emptyPublish.stderr).text(),
    ]);
    expect(emptyExit).toBe(1);
    expect(emptyStderr).toContain("No .yaml profiles found");
    expect(emptyStdout + emptyStderr).not.toContain(secret);
    const nested = path.join(dir, "nested");
    for (const [folder, id] of [
      ["all", "0123456789ABCDEFGHJK"],
      ["own", "0123456789ABCDEFGHJM"],
    ] as const) {
      await fs.mkdir(path.join(nested, folder), { recursive: true });
      await fs.writeFile(
        path.join(nested, folder, "stash.yaml"),
        YAML.stringify({
          "__sub-store": { id, target: "stash" },
        }),
      );
    }
    const published = spawn([process.execPath, entry.fullPath, "publish", nested], {
      cwd: root,
      env: {
        ...process.env,
        XDG_CONFIG_HOME: path.join(dir, "config"),
        SUB_STORE_API_TOKEN: secret,
        SUB_STORE_URL: server.url.origin,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [publishedExit, publishedStdout, publishedStderr] = await Promise.all([
      published.exited,
      new Response(published.stdout).text(),
      new Response(published.stderr).text(),
    ]);
    expect(publishedExit).toBe(0);
    expect(publishedStdout).toContain("Published 2 profile file(s).");
    expect(publishedStdout + publishedStderr).not.toContain(secret);
    expect(uploads).toBe(2);
    const configHome = path.join(dir, "config");
    await fs.mkdir(path.join(configHome, "sub-store"), { recursive: true });
    const tomlPath = path.join(configHome, "sub-store", "config.toml");
    const configToken = "private-config-upload-token";
    await fs.writeFile(tomlPath, `token = "${configToken}"\nbase-url = "${server.url.origin}"\n`);
    const configEnv = {
      ...process.env,
      XDG_CONFIG_HOME: configHome,
      XDG_CACHE_HOME: path.join(dir, "cache"),
      SUB_STORE_API_TOKEN: undefined,
      SUB_STORE_URL: undefined,
    };
    for (const configArgs of [[], ["--config", tomlPath]]) {
      const fromConfig = spawn(
        [process.execPath, entry.fullPath, "publish", nested, ...configArgs],
        { cwd: root, env: configEnv, stdout: "pipe", stderr: "pipe" },
      );
      const [configExit, configStdout, configStderr] = await Promise.all([
        fromConfig.exited,
        new Response(fromConfig.stdout).text(),
        new Response(fromConfig.stderr).text(),
      ]);
      expect({
        exitCode: configExit,
        output: configExit === 0 ? "" : configStdout + configStderr,
      }).toEqual({
        exitCode: 0,
        output: "",
      });
      expect(configStdout).toContain("Published 2 profile file(s).");
      expect(configStdout + configStderr).not.toContain(configToken);
    }
    expect(uploads).toBe(6);
    expect(uploadTokens.slice(2)).toEqual(Array(4).fill(`Bearer ${configToken}`));
    await fs.writeFile(tomlPath, `token = "${configToken}`);
    const malformed = spawn(
      [process.execPath, entry.fullPath, "publish", nested, "--config", tomlPath],
      { cwd: root, env: configEnv, stdout: "pipe", stderr: "pipe" },
    );
    const [malformedExit, malformedStdout, malformedStderr] = await Promise.all([
      malformed.exited,
      new Response(malformed.stdout).text(),
      new Response(malformed.stderr).text(),
    ]);
    expect(malformedExit).toBe(1);
    expect(malformedStderr).toContain("Invalid TOML configuration");
    expect(malformedStdout + malformedStderr).not.toContain(configToken);
    expect(uploads).toBe(6);
  } finally {
    await server.stop(true);
    await fs.rm(dir, { recursive: true, force: true });
  }
}, 30_000);
