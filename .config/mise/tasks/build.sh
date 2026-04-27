#!/bin/bash
# [MISE] depends = ["get-profiles"]
set -o errexit
set -o nounset
set -o pipefail

tmpdir="$PWD/tmp"
wrangler_flags=(--binding 'KV')
if [[ ${REMOTE-} == 'true' ]]; then wrangler_flags+=(--remote); fi

readarray -d '' -t profiles < <(find "$tmpdir/profiles" -name '*.yaml' -print0)
for profile in "${profiles[@]}"; do
  id="$(yq eval '.id' "$profile")"
  name="$(basename --suffix='.yaml' -- "$profile")"

  # mihomo
  key="artifacts/$id/mihomo.yaml"
  output="$tmpdir/artifacts/$name/mihomo.yaml"
  bun run './cli/bin/sub-store.ts' mihomo --output "$output" --profile "$profile"
  mihomo -f "$output" -t
  wrangler kv key put "$key" --path "$output" "${wrangler_flags[@]}"

  # stash
  key="artifacts/$id/stash.yaml"
  output="$tmpdir/artifacts/$name/stash.yaml"
  bun run './cli/bin/sub-store.ts' stash --output "$output" --profile "$profile"
  mihomo -f "$output" -t
  wrangler kv key put "$key" --path "$output" "${wrangler_flags[@]}"
done
