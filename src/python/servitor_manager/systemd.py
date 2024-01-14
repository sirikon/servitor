import configparser
import sys
import io


def print_systemd_file(content):
    sys.stderr.write(format_systemd_file(content))


def format_systemd_file(content):
    config = configparser.ConfigParser(strict=True)
    config = configparser.RawConfigParser()
    config.optionxform = lambda option: option

    for key in content:
        config[key] = content[key]

    string_io = io.StringIO()
    config.write(string_io, space_around_delimiters=False)
    result = string_io.getvalue()
    string_io.close()
    return result
