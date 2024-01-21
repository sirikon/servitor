#!/usr/bin/env bash
set -euo pipefail

SYSTEM_ROOT="${SYSTEM_ROOT:-}"
SERVITOR_REPOSITORY="github.com/sirikon/servitor"
SERVITOR_ROOT="${SYSTEM_ROOT}/opt/servitor"
SERVITOR_HOME="${SYSTEM_ROOT}/srv/servitor"
SERVITOR_SYSTEMD_SERVICE="${SYSTEM_ROOT}/etc/systemd/system/servitor.service"
SERVITOR_USER="servitor"

function main() {
    git_cmd="$(require_command git)"

    log "Installing Servitor"

    if [ ! -d "$SERVITOR_ROOT" ]; then
        log "Servitor repository not found. Cloning."
        "$git_cmd" clone "https://${SERVITOR_REPOSITORY}" "$SERVITOR_ROOT"
    else
        log "Servitor repository found. Pulling."
        (cd "$SERVITOR_ROOT" && "$git_cmd" pull)
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

    log "Installing systemd service"
    systemd_service >"$SERVITOR_SYSTEMD_SERVICE"
    systemctl daemon-reload
    systemctl enable servitor
}

function require_command() {
    for cmd in "$@"; do
        path="$(command -v "${cmd}" || printf '%s' '')"
        if [ "${path}" != "" ]; then
            echo "${path}"
            return 0
        fi
    done
    echo >&2 "Missing required command. Expected one of these:"
    echo >&2 "  $*"
    exit 1
}

function systemd_service() {
    cat <<EOF
[Unit]
Description=Servitor
After=network.target

[Service]
Type=simple
Restart=always
User=${SERVITOR_USER}
Environment="PYTHONPATH=${SERVITOR_ROOT}/src/python"
Environment="SERVITOR_UI_ROOT=${SERVITOR_ROOT}/src/ui"
ExecStart=/usr/bin/python3 -m servitor

[Install]
WantedBy=multi-user.target
EOF
}

function log {
    printf >&2 "░░░ %s\n" "${1}"
}

main "$@"
