#!/usr/bin/env bash
set -euo pipefail

REPOSITORY="github.com/sirikon/servitor"

SYSTEM_ROOT="${SYSTEM_ROOT:-}"
SERVITOR_ROOT="${SYSTEM_ROOT}/opt/servitor"

function main() {
    log "Installing Servitor"

    if [ ! -d "$SERVITOR_ROOT" ]; then
        log "Servitor repository not found. Cloning."
        git clone "https://${REPOSITORY}" "$SERVITOR_ROOT"
    else
        log "Servitor repository found. Pulling."
        (cd "$SERVITOR_ROOT" && git pull)
    fi
}

function log {
    printf "░░░ %s\n" "${1}"
}

main "$@"
