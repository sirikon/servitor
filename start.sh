#!/usr/bin/env bash
set -euo pipefail

TCP_PORT="40000"

function main() { (
    root="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"
    python_cmd="$(require_command python3 python)"
    socat_cmd="$(require_command socat)"

    cd "${root}/example"
    export PYTHONPATH="${root}/src/python"
    export SERVITOR_UI_ROOT="${root}/src/ui"

    "${socat_cmd}" "TCP-LISTEN:${TCP_PORT},fork" "UNIX-CLIENT:./servitor.sock" &
    proxy_pid=$!
    echo "### started proxy on PID $proxy_pid"
    echo "### http://127.0.0.1:${TCP_PORT}/ui/"

    "${python_cmd}" -m servitor "$@"

    if ps -p $proxy_pid >/dev/null; then
        echo "### killing proxy"
        kill $proxy_pid
    else
        echo "### proxy already killed"
    fi
); }

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

main "$@"
