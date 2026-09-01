#!/bin/bash
# [MISE] description = "Build and publish subscription artifacts and the Worker"
set -o errexit
set -o nounset
set -o pipefail

# Populate remote KV from a fresh profile snapshot before deploying its route.
publish_dir="$(mktemp -d)"
trap 'rm -r -- "$publish_dir"' EXIT
REMOTE=true SUB_STORE_TMPDIR="$publish_dir" mise run build
wrangler deploy --message "Publish subscription artifacts"
