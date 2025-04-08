#!/usr/bin/env bash
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
SYSTEM_ROOT="$root/.installer-workdir"
mkdir -p "$SYSTEM_ROOT"

export SYSTEM_ROOT
"$root/scripts/servitor-installer.sh" "$@"
