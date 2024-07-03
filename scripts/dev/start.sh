#!/usr/bin/env bash
set -meuo pipefail

TCP_PORT="40000"

function main() { (
    trap cleanup EXIT
    root="$(realpath "$(dirname "${BASH_SOURCE[0]}")/../..")"
    python_cmd="$(require_command python3 python)"
    socat_cmd="$(require_command socat)"

    cd "${root}/example"
    export PYTHONPATH="${root}/src/python"
    export SERVITOR_UI_ROOT="${root}/src/ui"

    "${python_cmd}" -m servitor "$@" &
    log "started servitor on PID $!"

    log "proxy will listen on http://127.0.0.1:${TCP_PORT}/"
    "${socat_cmd}" "TCP-LISTEN:${TCP_PORT},fork,reuseaddr" "UNIX-CLIENT:./sockets/servitor.sock"
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
        log "killing ${job_pid}"
        kill -INT "${job_pid}"
        wait "${job_pid}"
    done
}

function log() {
    printf "### [start.sh] %s\n" "$@"
}

main "$@"
