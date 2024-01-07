#!/usr/bin/env bash
set -euo pipefail

TCP_PORT="40000"

root="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"
python_cmd="$(command -v python3 || command -v python)"
(
    cd "${root}/example"
    export PYTHONPATH="${root}/src"
    socat "TCP-LISTEN:${TCP_PORT},fork" "UNIX-CLIENT:./servitor.sock" &
    PROXY_PID=$!
    echo "### started proxy on PID $PROXY_PID"
    echo "### http://127.0.0.1:${TCP_PORT}/ui/"
    "${python_cmd}" -m servitor "$@"
    if ps -p $PROXY_PID >/dev/null; then
        echo "### killing proxy"
        kill $PROXY_PID
    else
        echo "### proxy already killed"
    fi
)
