#!/usr/bin/env bash
set -euo pipefail

root="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"
SYSTEM_ROOT="$root/scripts/servitor-manager-test"
mkdir -p "$SYSTEM_ROOT"

export SYSTEM_ROOT
"$root/scripts/servitor-manager.sh" "$@"
