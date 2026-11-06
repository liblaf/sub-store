import type { Artifact } from "@/lib/core/builder";
import type { Profile, ProfileTarget } from "@/lib/core/profile";

import { MihomoBuilder } from "./mihomo/builder";
import { StashBuilder } from "./stash/builder";

/** Use the same target builder and validation for local builds and publication. */
export async function buildProfile(profile: Profile, target: ProfileTarget): Promise<Artifact> {
  const builder =
    target === "stash" ? new StashBuilder({ profile }) : new MihomoBuilder({ profile, target });
  return builder.build();
}
