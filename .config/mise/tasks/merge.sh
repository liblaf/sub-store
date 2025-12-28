#!/bin/bash
set -o errexit
set -o nounset
set -o pipefail

sub-store merge --filename 'mihomo.yaml' --template 'builtin://mihomo.yaml'
sub-store merge --filename 'stash.yaml' --template 'builtin://stash.yaml'
