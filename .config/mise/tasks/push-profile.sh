#!/bin/bash
set -o errexit
set -o nounset
set -o pipefail

NAMESPACE_ID="$(rbw get --field 'NAMESPACE_ID' 'API')"
WORKING_DIRECTORY="$(git rev-parse --show-toplevel)"

function put() {
  local key="$1"
  local path="$2"
  wrangler kv key put "$key" --namespace-id "$NAMESPACE_ID" --path "$path" --remote
}

UUID_ALL="$(rbw get --field 'UUID_ALL' 'API')"
put "$UUID_ALL/profile.yaml" "$WORKING_DIRECTORY/profile.all.yaml"
UUID_SHARED="$(rbw get --field 'UUID_SHARED' 'API')"
put "$UUID_SHARED/profile.yaml" "$WORKING_DIRECTORY/profile.shared.yaml"
