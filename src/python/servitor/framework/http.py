import http.server
import json
import re
import socket
import socketserver
import shutil
from os.path import getsize
from mimetypes import guess_type
from urllib.parse import urlparse
from typing import Callable

from servitor.framework.logging import log

_routes: dict[str, list[tuple[re.Pattern, Callable]]] = {}


def route(method: str, pattern: re.Pattern):
    def decorator(func):
        if method not in _routes:
            _routes[method] = []
        _routes[method].append((re.compile(pattern), func))
        return func

    return decorator


def handle_request(ctx: http.server.BaseHTTPRequestHandler, method: str):
    routing_path = urlparse(ctx.path).path
    try:
        for pattern, func in _routes[method]:
            match = pattern.match(routing_path)
            if match:
                func(ctx, **match.groupdict())
                return
        reply_not_found(ctx)
    except Exception:
        log.exception("error during request processing")
        reply_error(ctx)


def reply(ctx: http.server.BaseHTTPRequestHandler, code: int, type: str, body: bytes):
    ctx.send_response(code)
    ctx.send_header("Content-Type", f"{type}; charset=utf-8")
    ctx.send_header("Content-Length", str(len(body)))
    ctx.end_headers()
    ctx.wfile.write(body)


def reply_file(ctx: http.server.BaseHTTPRequestHandler, code: int, path: str):
    with open(path, "br") as f:
        ctx.send_response(code)
        ctx.send_header("Content-Type", f"{guess_type(path)[0]}; charset=utf-8")
        ctx.send_header("Content-Length", str(getsize(path)))
        ctx.end_headers()
        shutil.copyfileobj(f, ctx.wfile)


def reply_json(ctx: http.server.BaseHTTPRequestHandler, code: int, body: object):
    reply(ctx, code, "application/json", json.dumps(body).encode())


def reply_not_found(ctx: http.server.BaseHTTPRequestHandler):
    reply_json(ctx, 404, {"message": "Unknown path"})


def reply_error(ctx: http.server.BaseHTTPRequestHandler):
    reply_json(ctx, 500, {"message": "Something went wrong"})


class HTTPRequestHandler(http.server.BaseHTTPRequestHandler):
    server_version = "Servitor"
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        handle_request(self, "GET")

    def do_POST(self):
        handle_request(self, "POST")

    def log_message(self, format, *args):
        log.debug(f"request {format % args}")

    def version_string(self):
        return self.server_version


# Ugly? yes
# Works? yes
# https://stackoverflow.com/a/21650502
class UnixHTTPServer(http.server.ThreadingHTTPServer):
    address_family = socket.AF_UNIX

    def server_bind(self):
        socketserver.TCPServer.server_bind(self)
        self.server_name = "foo"
        self.server_port = 0
