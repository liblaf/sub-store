#!/bin/bash
set -o errexit
set -o nounset
set -o pipefail

tmpdir="$PWD/tmp"
wrangler_flags=(--binding 'KV')
if [[ ${REMOTE-} == 'true' ]]; then wrangler_flags+=(--remote); fi

readarray -t profile_keys < <(
  wrangler kv key list "${wrangler_flags[@]}" --prefix 'profiles/' "$@" |
    yq eval '.[].name'
)
for key in "${profile_keys[@]}"; do
  file="$tmpdir/$key"
  mkdir --parents --verbose "$(dirname -- "$file")"
  echo "'KV:$key' -> '$file'" 1>&2
  wrangler kv key get "$key" --text "${wrangler_flags[@]}" "$@" > "$file"
done
