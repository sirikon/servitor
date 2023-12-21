import http.server
import json
import re
from typing import Callable
from urllib.parse import urlparse, parse_qs
from servitor.jobs import get_job_execution, get_job_execution_log, get_job_executions

from servitor.logging import log
from servitor.shared_memory import shared_memory

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
        routes[method].append((re.compile(pattern), func))
        return func

    return decorator


@route("POST", r"^\/api/jobs/run$")
def jobs_run(ctx: http.server.BaseHTTPRequestHandler):
    query = parse_qs(urlparse(ctx.path).query)
    shared_memory.job_queue.put(query["job_id"][0])
    reply_json(ctx, 200, {"status": "success"})


@route("GET", r"^\/api/jobs/executions/get_list$")
def jobs_executions_get_list(ctx: http.server.BaseHTTPRequestHandler):
    query = parse_qs(urlparse(ctx.path).query)
    reply_json(
        ctx, 200, {"status": "success", "data": get_job_executions(query["job_id"][0])}
    )


@route("GET", r"^\/api/jobs/executions/get$")
def jobs_executions_get(ctx: http.server.BaseHTTPRequestHandler):
    query = parse_qs(urlparse(ctx.path).query)
    reply_json(
        ctx,
        200,
        {
            "status": "success",
            "data": get_job_execution(query["job_id"][0], query["execution_id"][0]),
        },
    )


@route("GET", r"^\/api/jobs/executions/logs/get$")
def jobs_executions_logs_get(ctx: http.server.BaseHTTPRequestHandler):
    query = parse_qs(urlparse(ctx.path).query)
    reply(
        ctx,
        200,
        "text/plain",
        get_job_execution_log(query["job_id"][0], query["execution_id"][0]),
    )


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

    def do_POST(self):
        handle_request(self, "POST")

    def log_message(self, format, *args):
        log.debug(f"request address:{self.address_string()} {format % args}")
