import { describe, expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import ky from "ky";
import YAML from "yaml";

import { MihomoBuilder } from "@/lib/formats/mihomo/builder";
import { MIHOMO_CONFIG_SCHEMA } from "@/lib/formats/mihomo/schema";
import type { MihomoProxy } from "@/lib/formats/mihomo/schema";
import { StashBuilder } from "@/lib/formats/stash/builder";
import { fetcher } from "@/lib/utils";
import { Fetcher } from "@/lib/utils/cache-fetch";

import { unwrapProxies } from "./builder";
import { PROFILE_SCHEMA } from "./profile";
import type { ProfileTarget } from "./profile";
import type { ProxyWrapper } from "./proxy";
import { renderProfile } from "./template";

// Exercise native rendering without requiring the external Mihomo executable.
class RenderMihomoBuilder extends MihomoBuilder {
  public override async render(
    providers: ReadonlyMap<string, ProxyWrapper<MihomoProxy>[]>,
    infoProxies: ProxyWrapper<MihomoProxy>[],
  ): Promise<string> {
    return renderProfile({
      profile: this.profile,
      providers: new Map([...providers].map(([name, proxies]) => [name, unwrapProxies(proxies)])),
      infoProxies: unwrapProxies(infoProxies),
      schema: MIHOMO_CONFIG_SCHEMA,
    });
  }
}

const subscriptionUrl = "https://subscription.example.invalid/private-token";
const counterUrl = "https://counter.example.invalid/private-token?password=secret";

function createBuilder(target: ProfileTarget) {
  const profile = PROFILE_SCHEMA.parse({
    "__sub-store": { target },
    "proxy-providers": {
      Counter: { url: subscriptionUrl, "__sub-store": { bwcounter: counterUrl } },
    },
    "proxy-groups": [{ name: "Information", type: "select", use: ["$info"] }],
  });
  return target === "mihomo" ? new RenderMihomoBuilder({ profile }) : new StashBuilder({ profile });
}

function subscriptionResponse(header?: string): Response {
  return new Response("proxies:\n  - name: Example Node\n    type: direct\n", {
    headers: {
      Date: "Tue, 01 Sep 2026 12:00:00 GMT",
      ...(header === undefined ? {} : { "Subscription-Userinfo": header }),
    },
  });
}

for (const target of ["mihomo", "stash"] as const) {
  describe(`${target} bwcounter integration`, () => {
    for (const header of [undefined, "ignored=1; total=NaN"]) {
      test(`renders API quota and reset with ${header === undefined ? "missing" : "invalid"} header`, async () => {
        const originalFetch = fetcher.fetch;
        const requests: string[] = [];
        fetcher.fetch = async (url): Promise<Response> => {
          requests.push(String(url));
          if (String(url) === subscriptionUrl) return subscriptionResponse(header);
          if (String(url) === counterUrl) {
            return Response.json({
              monthly_bw_limit_b: 200,
              bw_counter_b: 50,
              bw_reset_day_of_month: 15,
            });
          }
          throw new Error("Unexpected test request");
        };
        try {
          const artifact = await createBuilder(target).build();
          const config = YAML.parse(artifact.body);
          const names = [
            "[Counter] 📊 150 B / 200 B (75%)",
            "[Counter] 🔁 15",
            "[Counter] 📥 2026-09-01",
          ];
          expect(requests).toEqual([subscriptionUrl, counterUrl]);
          expect(config["proxy-groups"]).toEqual([
            { name: "Information", type: "select", proxies: names },
          ]);
          expect(config.proxies.map(({ name }: { name: string }) => name)).toEqual([
            "Example Node",
            ...names,
          ]);
          expect(artifact.metadata.headers).toEqual({});
          expect(artifact.body).not.toContain("⌛");
          expect(artifact.body).not.toContain(counterUrl);
        } finally {
          fetcher.fetch = originalFetch;
        }
      });
    }

    test("retains recognized subscription header precedence", async () => {
      const originalFetch = fetcher.fetch;
      const requests: string[] = [];
      fetcher.fetch = async (url): Promise<Response> => {
        requests.push(String(url));
        return subscriptionResponse("upload=20; download=30; total=100");
      };
      try {
        const artifact = await createBuilder(target).build();
        const config = YAML.parse(artifact.body);
        expect(requests).toEqual([subscriptionUrl]);
        expect(config["proxy-groups"][0].proxies).toEqual([
          "[Counter] 📊 50.0 B / 100 B (50%)",
          "[Counter] 📥 2026-09-01",
        ]);
        expect(artifact.metadata.headers).toEqual({
          "Subscription-Userinfo": "upload=20; download=30; total=100",
        });
      } finally {
        fetcher.fetch = originalFetch;
      }
    });

    test.each(["subscription", "counter"] as const)(
      "marks exhausted info nodes when only the %s response is stale",
      async (source): Promise<void> => {
        const directory = await mkdtemp(path.join(os.tmpdir(), "sub-store-info-"));
        const originalFetch = fetcher.fetch;
        const staleUrl = source === "subscription" ? subscriptionUrl : counterUrl;
        let fail = false;
        const cachedFetcher = new Fetcher(
          ky.create({
            retry: 0,
            fetch: async (input): Promise<Response> => {
              const url = new Request(input).url;
              if (fail && url === staleUrl) throw new TypeError("offline");
              return url === subscriptionUrl
                ? subscriptionResponse()
                : Response.json({
                    monthly_bw_limit_b: 200,
                    bw_counter_b: 200,
                    bw_reset_day_of_month: 15,
                  });
            },
          }),
          directory,
        );
        try {
          await cachedFetcher.fetch(
            staleUrl,
            source === "subscription" ? { headers: { "User-Agent": "clash.meta" } } : undefined,
          );
          const [file] = await readdir(directory);
          const cacheFile = path.join(directory, file!);
          const cached = JSON.parse(await readFile(cacheFile, "utf-8"));
          cached.storedAt = 0;
          await writeFile(cacheFile, JSON.stringify(cached));
          fail = true;
          fetcher.fetch = cachedFetcher.fetch.bind(cachedFetcher);

          const artifact = await createBuilder(target).build();
          const config = YAML.parse(artifact.body);
          const names = [
            "[Counter] 🔴 ⚠️ 📊 0.00 B / 200 B (0%)",
            "[Counter] 🔴 ⚠️ 🔁 15",
            "[Counter] 🔴 ⚠️ 📥 2026-09-01",
          ];
          expect(config["proxy-groups"][0].proxies).toEqual(names);
          expect(config.proxies.map(({ name }: { name: string }) => name)).toEqual([
            "Example Node",
            ...names,
          ]);
          expect(artifact.metadata.headers).toEqual({});
        } finally {
          fetcher.fetch = originalFetch;
          await rm(directory, { recursive: true, force: true });
        }
      },
    );

    test("withholds configured API credentials and diagnostics on failure", async () => {
      const originalFetch = fetcher.fetch;
      fetcher.fetch = async (url): Promise<Response> => {
        if (String(url) === subscriptionUrl) return subscriptionResponse();
        throw new Error(`Upstream failure: ${counterUrl}`);
      };
      try {
        let failure: unknown;
        try {
          await createBuilder(target).build();
        } catch (error) {
          failure = error;
        }
        expect(failure).toBeInstanceOf(Error);
        expect((failure as Error).message).toBe(
          "Provider fetch or validation failed: https://subscription.example.invalid",
        );
        expect((failure as Error).cause).toBeUndefined();
      } finally {
        fetcher.fetch = originalFetch;
      }
    });
  });
}
