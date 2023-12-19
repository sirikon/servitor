import http.server
import urllib
import json
import re
from typing import Callable
from urllib.parse import urlparse, parse_qs

from servitor.logging import log
from servitor.shared_memory import get_job_queue

routes: dict[str, list[tuple[re.Pattern, Callable]]] = {}


def reply(ctx: http.server.BaseHTTPRequestHandler, code: int, type: str, body: bytes):
    ctx.send_response(code)
    ctx.send_header("Content-Type", type)
    ctx.send_header("Content-Length", str(len(body)))
    ctx.end_headers()
    ctx.wfile.write(body)


def reply_json(ctx: http.server.BaseHTTPRequestHandler, code: int, body: object):
    reply(ctx, code, "application/json", json.dumps(body).encode())


def route(method: str, pattern: re.Pattern):
    def decorator(func):
        if method not in routes:
            routes[method] = []
        routes[method].append((re.compile(rf"^\/{pattern}$"), func))
        return func

    return decorator


@route("GET", r"api/jobs/get")
def hello(ctx: http.server.BaseHTTPRequestHandler):
    get_job_queue().put(ctx.path)
    query = parse_qs(urlparse(ctx.path).query)
    reply_json(ctx, 200, {"path": ctx.path, "query": query})


def handle_request(ctx: http.server.BaseHTTPRequestHandler, method: str):
    routing_path = urlparse(ctx.path).path
    try:
        for pattern, func in routes[method]:
            match = pattern.match(routing_path)
            if match:
                func(ctx, **match.groupdict())
                return
        reply_json(ctx, 404, {"message": "Unknown path"})
    except Exception:
        log.exception("error during request processing")
        reply_json(ctx, 500, {"message": "Something went wrong"})


class HTTPRequestHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        handle_request(self, "GET")

    def log_message(self, format, *args):
        log.debug(f"request address:{self.address_string()} {format % args}")
