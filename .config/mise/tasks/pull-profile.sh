#!/bin/bash
set -o errexit
set -o nounset
set -o pipefail

NAMESPACE_ID="$(rbw get --field 'NAMESPACE_ID' 'API')"
WORKING_DIRECTORY="$(git rev-parse --show-toplevel)"

function get() {
  local key="$1"
  wrangler kv key get "$key" --namespace-id "$NAMESPACE_ID" --remote |
    sed "1 { /Proxy environment variables detected. We'll use your proxy for fetch requests./d }"
}

UUID_ALL="$(rbw get --field 'UUID_ALL' 'API')"
get "$UUID_ALL/profile.yaml" > "$WORKING_DIRECTORY/profile.all.yaml"
UUID_SHARED="$(rbw get --field 'UUID_SHARED' 'API')"
get "$UUID_SHARED/profile.yaml" > "$WORKING_DIRECTORY/profile.shared.yaml"
