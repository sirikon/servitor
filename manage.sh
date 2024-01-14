#!/usr/bin/env bash
set -euo pipefail

function main() { (
    root="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"
    python_cmd="$(require_command python3 python)"

    export PYTHONPATH="${root}/src/python"

    "${python_cmd}" -m servitor_manager "$@"
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
