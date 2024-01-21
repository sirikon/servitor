#!/usr/bin/env bash
set -euo pipefail

SYSTEM_ROOT="${SYSTEM_ROOT:-}"
SERVITOR_REPOSITORY="github.com/sirikon/servitor"
SERVITOR_ROOT="${SYSTEM_ROOT}/opt/servitor"
SERVITOR_HOME="${SYSTEM_ROOT}/srv/servitor"
SERVITOR_USER="servitor"

function main() {
    log "Installing Servitor"

    if [ ! -d "$SERVITOR_ROOT" ]; then
        log "Servitor repository not found. Cloning."
        git clone "https://${SERVITOR_REPOSITORY}" "$SERVITOR_ROOT"
    else
        log "Servitor repository found. Pulling."
        (cd "$SERVITOR_ROOT" && git pull)
    fi

    if ! id "$SERVITOR_USER" >/dev/null 2>&1; then
        log "Servitor user not found. Creating"
        useradd \
            --system \
            --no-create-home \
            --shell=/bin/false \
            "$SERVITOR_USER"
    else
        log "Servitor user already exists. Skipping."
    fi

    log "Ensuring servitor home directory exists and has the correct permissions"
    mkdir -p "$SERVITOR_HOME"
    chown -R servitor:servitor "$SERVITOR_HOME"
}

function log {
    printf "░░░ %s\n" "${1}"
}

main "$@"
