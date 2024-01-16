#!/usr/bin/env python3
import argparse
import sys
import os
import os.path

from servitor_manager.systemd import format_systemd_file, print_systemd_file


def main():
    args = cli()

    match args.subcommand:
        case "gen-systemd-service":
            print_systemd_file(get_systemd_service_def(args.user, args.python))
        case _:
            print("Unknown subcommand " + args.subcommand)


def get_systemd_service_def(user, python):
    return {
        "Unit": {
            "Description": "Servitor",
        },
        "Service": {
            "User": user,
            "Type": "simple",
            "Environment": "PYTHONPATH="
            + os.path.normpath(
                os.path.join(os.path.dirname(__file__), "../../src/python")
            ),
            "WorkingDirectory": "idunno",
            "ExecStart": f"{python} -m servitor",
            "Restart": "always",
            "After": "network.target",
        },
        "Install": {"WantedBy": "multi-user.target"},
    }


def cli():
    parser = argparse.ArgumentParser(prog="servitor_manager")
    subparsers = parser.add_subparsers()

    setup_parser = subparsers.add_parser("setup")
    setup_parser.set_defaults(subcommand="setup")

    gen_sysd_parser = subparsers.add_parser("gen-systemd-service")
    gen_sysd_parser.set_defaults(subcommand="gen-systemd-service")

    gen_sysd_parser.add_argument(
        "-u",
        "--user",
        help="user to use. defaults to current user",
        default=os.getlogin(),
    )
    gen_sysd_parser.add_argument(
        "-p",
        "--python",
        help="python command to use. defaults to 'python3'",
        default="python3",
    )

    if len(sys.argv) == 1:
        parser.print_help(sys.stderr)
        sys.exit(1)
    return parser.parse_args()


if __name__ == "__main__":
    main()
