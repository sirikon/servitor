#!/usr/bin/env bash
set -euo pipefail

TCP_PORT="40000"

function main() { (
    trap wait EXIT
    root="$(realpath "$(dirname "${BASH_SOURCE[0]}")/../..")"
    python_cmd="$(require_command python3 python)"
    socat_cmd="$(require_command socat)"

    cd "${root}/example"
    export PYTHONPATH="${root}/src/python"
    export SERVITOR_UI_ROOT="${root}/src/ui"

    "${python_cmd}" -m servitor "$@" &
    "${socat_cmd}" "TCP-LISTEN:${TCP_PORT},fork,reuseaddr" "UNIX-CLIENT:./sockets/servitor.sock" &
    log "proxy will listen on http://127.0.0.1:${TCP_PORT}/"
    wait
); }

function require_command() {
    for cmd in "$@"; do
        path="$(command -v "${cmd}" || printf '%s' '')"
        if [ "${path}" != "" ]; then
            printf "%s\n" "${path}"
            return 0
        fi
    done
    log >&2 "Missing required command. Expected one of these:"
    log >&2 "  $*"
    exit 1
}

function log() {
    printf "### [start.sh] %s\n" "$@"
}

main "$@"
