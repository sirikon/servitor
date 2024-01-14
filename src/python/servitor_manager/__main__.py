#!/usr/bin/env python3
import argparse
import configparser
import sys
import os
import os.path


def main():
    args = get_args()

    print_systemd_file(
        {
            "Unit": {
                "Description": "Servitor",
            },
            "Service": {
                "User": args.user,
                "Type": "simple",
                "Environment": "PYTHONPATH="
                + os.path.normpath(
                    os.path.join(os.path.dirname(__file__), "../../src/python")
                ),
                "WorkingDirectory": "idunno",
                "ExecStart": f"{args.python} -m servitor",
                "Restart": "always",
                "After": "network.target",
            },
            "Install": {"WantedBy": "multi-user.target"},
        }
    )


def get_args():
    parser = argparse.ArgumentParser(prog="servitor_manager")
    parser.add_argument(
        "-u",
        "--user",
        help="user to use. defaults to current user",
        default=os.getlogin(),
    )
    parser.add_argument(
        "-p",
        "--python",
        help="python command to use. defaults to 'python3'",
        default="python3",
    )
    return parser.parse_args()


def print_systemd_file(content):
    config = configparser.ConfigParser(strict=True)
    config = configparser.RawConfigParser()
    config.optionxform = lambda option: option

    for key in content:
        config[key] = content[key]

    config.write(sys.stdout, space_around_delimiters=False)


if __name__ == "__main__":
    main()
