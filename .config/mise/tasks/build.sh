#!/bin/bash
# [MISE] depends = ["get-profiles"]
set -o errexit
set -o nounset
set -o pipefail

tmpdir="${SUB_STORE_TMPDIR:-$PWD/tmp}"
wrangler_flags=(--binding 'KV')
if [[ ${REMOTE-} == 'true' ]]; then wrangler_flags+=(--remote); fi

readarray -d '' -t profiles < <(find "$tmpdir/profiles" -name '*.yaml' -print0)
if ((${#profiles[@]} == 0)); then
  echo "No provider profiles found under $tmpdir/profiles" 1>&2
  exit 1
fi
for profile in "${profiles[@]}"; do
  name="$(basename --suffix='.yaml' -- "$profile")"

  output="$tmpdir/artifacts/$name/mihomo.yaml"
  bun run './cli/bin/sub-store.ts' build mihomo --template templates/mihomo.yaml --output "$output" --providers "$profile"
  mihomo -f "$output" -t

  output="$tmpdir/artifacts/$name/stash.yaml"
  bun run './cli/bin/sub-store.ts' build stash --template templates/stash.yaml --output "$output" --providers "$profile"
done

# Do not write any artifact until every profile and format has validated.
entries=()
for profile in "${profiles[@]}"; do
  id="$(yq eval '.id' "$profile")"
  name="$(basename --suffix='.yaml' -- "$profile")"
  for target in mihomo stash; do
    key="artifacts/$id/$target.yaml"
    output="$tmpdir/artifacts/$name/$target.yaml"
    entries+=("$(
      jq --compact-output --null-input \
        --arg key "$key" \
        --rawfile value "$output" \
        --slurpfile metadata "$output.metadata.json" \
        '{key: $key, value: $value, metadata: $metadata[0]}'
    )")
  done
done

bulk_file="$(mktemp --suffix='.json')"
trap 'rm --force -- "$bulk_file"' EXIT
printf '%s\n' "${entries[@]}" | jq --slurp >"$bulk_file"
wrangler kv bulk put "$bulk_file" "${wrangler_flags[@]}"
