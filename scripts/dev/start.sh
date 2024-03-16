#!/usr/bin/env bash
set -euo pipefail

TCP_PORT="40000"

function main() { (
    trap cleanup EXIT
    root="$(realpath "$(dirname "${BASH_SOURCE[0]}")/../..")"
    python_cmd="$(require_command python3 python)"
    socat_cmd="$(require_command socat)"

    cd "${root}/example"
    export PYTHONPATH="${root}/src/python"
    export SERVITOR_UI_ROOT="${root}/src/ui"

    "${socat_cmd}" "TCP-LISTEN:${TCP_PORT},fork" "UNIX-CLIENT:./sockets/servitor.sock" &
    log "started proxy on PID $!"
    log "listening on http://127.0.0.1:${TCP_PORT}/"

    "${python_cmd}" -m servitor "$@"
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

function cleanup() {
    log "cleaning up"
    jobs -l
    for job_pid in $(jobs -p); do
        kill "${job_pid}"
    done
}

function log() {
    printf "### [start.sh] %s\n" "$@"
}

main "$@"
