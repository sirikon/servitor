#!/usr/bin/env bash
set -euo pipefail

root="$(dirname "$(realpath "${BASH_SOURCE[0]}")")"
python_cmd="$(command -v python3 || command -v python)"
(
    cd "${root}/example"
    export PYTHONPATH="${root}/src"
    "${python_cmd}" -m servitor "$@"
)
