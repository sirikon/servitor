import http.server
import json
import re
from os import sep
from mimetypes import guess_type
from os.path import join, normpath, dirname
from typing import Callable
from urllib.parse import urlparse, parse_qs
from servitor.jobs import (
    create_job_execution,
    get_job_execution,
    get_job_execution_log,
    get_job_executions,
    get_jobs,
)

from servitor.logging import log
from servitor.shared_memory import JobQueueItem, shared_memory

routes: dict[str, list[tuple[re.Pattern, Callable]]] = {}


def reply(ctx: http.server.BaseHTTPRequestHandler, code: int, type: str, body: bytes):
    ctx.send_response(code)
    ctx.send_header("Content-Type", f"{type}; charset=utf-8")
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


@route("GET", r"^\/api/jobs/get_list$")
def jobs_get_list(ctx: http.server.BaseHTTPRequestHandler):
    query = parse_qs(urlparse(ctx.path).query)
    path = query["path"][0] if "path" in query else "."
    reply_json(ctx, 200, get_jobs(path))


@route("POST", r"^\/api/jobs/run$")
def jobs_run(ctx: http.server.BaseHTTPRequestHandler):
    query = parse_qs(urlparse(ctx.path).query)
    job_id = query["job_id"][0]
    execution_id = create_job_execution(job_id)
    shared_memory.job_queue.put(JobQueueItem(job_id, execution_id))
    reply_json(ctx, 200, {"status": "success"})


@route("GET", r"^\/api/jobs/executions/get_list$")
def jobs_executions_get_list(ctx: http.server.BaseHTTPRequestHandler):
    query = parse_qs(urlparse(ctx.path).query)
    reply_json(ctx, 200, get_job_executions(query["job_id"][0]))


@route("GET", r"^\/api/jobs/executions/get$")
def jobs_executions_get(ctx: http.server.BaseHTTPRequestHandler):
    query = parse_qs(urlparse(ctx.path).query)
    reply_json(
        ctx, 200, get_job_execution(query["job_id"][0], query["execution_id"][0])
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


@route("GET", r"^\/ui$")
def serve_ui(ctx: http.server.BaseHTTPRequestHandler):
    ctx.send_response(302)
    ctx.send_header("Location", "/ui/")
    ctx.end_headers()


@route("GET", r"^\/ui/(?P<rest>.*)")
def serve_ui(ctx: http.server.BaseHTTPRequestHandler, rest: str = "index.html"):
    if rest == "":
        rest = "index.html"
    base_path = normpath(join(dirname(__file__), "..", "ui"))
    ui_file_path = normpath(join(base_path, rest))

    if not ui_file_path.startswith(base_path + sep):
        reply(ctx, 404, "text/plain", b"")
        return

    with open(ui_file_path, "br") as f:
        reply(ctx, 200, guess_type(ui_file_path)[0], f.read())


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
