#!/bin/bash
set -o errexit
set -o nounset
set -o pipefail

tmpdir="$PWD/tmp"
wrangler_flags=(--binding 'KV')
if [[ ${REMOTE-} == 'true' ]]; then wrangler_flags+=(--remote); fi

readarray -d '' -t profiles < <(find "$tmpdir/profiles" -name '*.yaml' -print0)
for profile in "${profiles[@]}"; do
  filename="$(basename -- "$profile")"
  key="profiles/$filename"
  wrangler kv key put "$key" --path "$profile" "${wrangler_flags[@]}" "$@"
done
