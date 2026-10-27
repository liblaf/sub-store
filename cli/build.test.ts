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
  const server = serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => {
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
    const secret = "private-subscription-token";
    for (const target of ["mihomo", "stash"] as const) {
      await fs.writeFile(
        profile,
        YAML.stringify({
          "__sub-store": {
            id: "0123456789ABCDEFGHJK",
            target: target === "mihomo" ? "stash" : "mihomo",
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
      env: { ...process.env, SUB_STORE_API_TOKEN: secret, SUB_STORE_URL: "https://example.test" },
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
  } finally {
    await server.stop(true);
    await fs.rm(dir, { recursive: true, force: true });
  }
}, 30_000);
