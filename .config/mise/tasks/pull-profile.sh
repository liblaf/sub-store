#!/bin/bash
set -o errexit
set -o nounset
set -o pipefail

NAMESPACE_ID="$(rbw get --field "NAMESPACE_ID" "API")"
WORKING_DIRECTORY="$(git rev-parse --show-toplevel)"

function get() {
  local key="$1"
  wrangler kv key get "$key" --namespace-id "$NAMESPACE_ID" --remote |
    sed "1 { /Proxy environment variables detected. We'll use your proxy for fetch requests./d }"
}

function put() {
  local key="$1"
  local path="$2"
  wrangler kv key put "$key" --namespace-id "$NAMESPACE_ID" --path "$path" --remote
}

get "profile.yaml" > "$WORKING_DIRECTORY/profile.yaml"
