import { expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";

import { serve, spawn } from "bun";
import { build } from "bunup";
import YAML from "yaml";

import config from "@/bunup.config";
import { STASH_CONFIG_SCHEMA } from "@/lib/formats/stash/schema";

test("packaged CLI preserves Unicode info labels and Taiwan membership", async (): Promise<void> => {
  const root = path.resolve(import.meta.dir, "..");
  await fs.mkdir(path.join(root, "tmp"), { recursive: true });
  const dir = await fs.mkdtemp(path.join(root, "tmp", "cli-test-"));
  const taiwanName = "🇨🇳台湾专线01|BGP|流媒体";
  const server = serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request): Response {
      const route = new URL(request.url).pathname;
      if (route === "/bwcounter") {
        return Response.json({
          monthly_bw_limit_b: 200,
          bw_counter_b: 100,
          bw_reset_day_of_month: 2,
        });
      }
      if (route !== "/counter" && route !== "/header") {
        return new Response("Not found", { status: 404 });
      }
      return new Response(
        YAML.stringify({
          proxies: [
            { name: taiwanName, type: "direct" },
            { name: "US Node", type: "direct" },
          ],
        }),
        {
          headers: {
            Date: "Sat, 12 Sep 2026 12:00:00 GMT",
            ...(route === "/header"
              ? { "Subscription-Userinfo": "upload=20; download=30; total=100; expire=1798761600" }
              : {}),
          },
        },
      );
    },
  });

  try {
    const built = await build(
      {
        ...config,
        outDir: path.relative(root, path.join(dir, "dist")),
        // Exercise the executable build without declarations or repository mutations.
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
      YAML.stringify({
        id: "00000000-0000-4000-8000-000000000000",
        vars: { TS_AUTH_KEY: "test-tailscale-auth-key" },
        providers: [
          {
            name: "JMS",
            mihomo: new URL("counter", server.url).href,
            bwcounter: new URL("bwcounter", server.url).href,
          },
          { name: "Header", mihomo: new URL("header", server.url).href },
        ],
      }),
    );
    const child = spawn(
      [process.execPath, entry.fullPath, "build", "stash", "-p", profile, "-o", output],
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
    const artifact = STASH_CONFIG_SCHEMA.parse(YAML.parse(await fs.readFile(output, "utf8")));
    const groups = Object.fromEntries(
      artifact["proxy-groups"].map(({ name, proxies }) => [name, proxies]),
    );
    expect(groups.Taiwan).toEqual([`[JMS] ${taiwanName}`, `[Header] ${taiwanName}`]);
    expect(groups.Info).toEqual([
      "[JMS] 📊 100 B / 200 B (50%)",
      "[JMS] 🔁 2",
      "[JMS] 📥 2026-09-12",
      "[Header] 📊 50.0 B / 100 B (50%)",
      "[Header] ⌛ 2027-01-01",
      "[Header] 📥 2026-09-12",
    ]);
  } finally {
    await server.stop(true);
    await fs.rm(dir, { recursive: true, force: true });
  }
}, 30_000);
