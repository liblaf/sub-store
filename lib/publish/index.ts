import fs from "node:fs/promises";
import path from "node:path";

import YAML from "yaml";

import { PROFILE_SCHEMA } from "@/lib/core/profile";
import type { Profile } from "@/lib/core/profile";
import { MihomoBuilder } from "@/lib/formats/mihomo/builder";
import { StashBuilder } from "@/lib/formats/stash/builder";

import { ARTIFACT_UPLOAD_SCHEMA, MAX_UPLOAD_BYTES } from "./schema";

export type PublishOptions = {
  url: string;
  token: string;
};

/** Build every profile before uploading any of its artifacts to the Worker. */
export async function publishProfiles(inputPath: string, options: PublishOptions): Promise<number> {
  const baseUrl = new URL(options.url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname);
  if (baseUrl.protocol !== "https:" && !(local && baseUrl.protocol === "http:")) {
    throw new Error("SUB_STORE_URL must use HTTPS (HTTP is allowed for localhost)");
  }
  if (
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.pathname !== "/" ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    throw new Error(
      "SUB_STORE_URL must be an origin without credentials, a path, a query, or a fragment",
    );
  }
  if (!options.token.trim()) throw new Error("SUB_STORE_API_TOKEN is required");

  const files: string[] = (await fs.stat(inputPath)).isDirectory()
    ? (await fs.readdir(inputPath))
        .filter((name: string): boolean => !name.startsWith(".") && name.endsWith(".yaml"))
        .sort()
        .map((name: string): string => path.join(inputPath, name))
    : [inputPath];
  if (files.length === 0) throw new Error("No .yaml profiles found");

  const profiles: Profile[] = [];
  const ids = new Set<string>();
  for (const file of files) {
    const profile = PROFILE_SCHEMA.parse(YAML.parse(await fs.readFile(file, "utf-8")));
    if (ids.has(profile.id)) throw new Error("Duplicate profile IDs in publish input");
    ids.add(profile.id);
    profiles.push(profile);
  }

  const uploads: { id: string; body: string }[] = [];
  for (const profile of profiles) {
    const mihomo = new MihomoBuilder({ profile, template: "builtin://mihomo.yaml" });
    const stash = new StashBuilder({ profile, template: "builtin://stash.yaml" });
    const body = JSON.stringify(
      ARTIFACT_UPLOAD_SCHEMA.parse({
        mihomo: await mihomo.build(),
        stash: await stash.build(),
      }),
    );
    if (new TextEncoder().encode(body).byteLength > MAX_UPLOAD_BYTES) {
      throw new Error("Profile artifacts exceed the 10 MiB upload limit");
    }
    uploads.push({ id: profile.id, body });
  }

  for (const { id, body } of uploads) {
    const url = new URL(`/api/profiles/${id}/artifacts`, baseUrl);
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${options.token}`,
        "Content-Type": "application/json",
      },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
    });
    await response.body?.cancel();
    if (response.status !== 204) {
      throw new Error(`Artifact upload failed (HTTP ${response.status})`);
    }
  }
  return profiles.length;
}
