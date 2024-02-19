#!/usr/bin/env bash
set -euo pipefail

root="$(realpath "$(dirname "${BASH_SOURCE[0]}")/../..")"
SYSTEM_ROOT="$root/.installer-workdir"
mkdir -p "$SYSTEM_ROOT"

export SYSTEM_ROOT
"$root/scripts/servitor-installer.sh" "$@"
