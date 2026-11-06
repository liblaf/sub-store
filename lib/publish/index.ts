import { loadProfile } from "@/lib/core/load-profile";
import type { Profile, ProfileTarget } from "@/lib/core/profile";
import { buildProfile } from "@/lib/formats/build";

import { discoverProfiles } from "./discover";
import { PublishInputError } from "./errors";
import type { ArtifactUpload } from "./schema";
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
    throw new Error("publish.base-url must use HTTPS (HTTP is allowed for localhost)");
  }
  if (
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.pathname !== "/" ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    throw new Error(
      "publish.base-url must be an origin without credentials, a path, a query, or a fragment",
    );
  }
  if (!options.token.trim()) throw new Error("publish.token is required");

  const files = await discoverProfiles(inputPath);

  const profiles: { profile: Profile; id: string; target: ProfileTarget }[] = [];
  const pairs = new Set<string>();
  for (const file of files) {
    const profile = await loadProfile(file);
    const { id, target } = profile["__sub-store"] ?? {};
    if (!id || !target)
      throw new PublishInputError("Publishing requires __sub-store.id and __sub-store.target");
    const pair = `${id}/${target}`;
    if (pairs.has(pair))
      throw new PublishInputError("Duplicate profile ID and target in publish input");
    pairs.add(pair);
    profiles.push({ profile, id, target });
  }

  const artifacts = new Map<string, ArtifactUpload>();
  for (const { profile, id, target } of profiles) {
    const group = artifacts.get(id) ?? {};
    group[target] = await buildProfile(profile, target);
    artifacts.set(id, group);
  }
  const uploads: { id: string; body: string }[] = [];
  for (const [id, group] of artifacts) {
    const body = JSON.stringify(ARTIFACT_UPLOAD_SCHEMA.parse(group));
    if (new TextEncoder().encode(body).byteLength > MAX_UPLOAD_BYTES) {
      throw new Error("Profile artifacts exceed the 10 MiB upload limit");
    }
    uploads.push({ id, body });
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
