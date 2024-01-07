import http.server
from os import sep
from mimetypes import guess_type
from os.path import join, normpath, dirname
from urllib.parse import urlparse, parse_qs

from servitor.framework.http import handle_request, reply, reply_json, route
from servitor.jobs import (
    get_jobs,
)
from servitor.framework.logging import log
from servitor.shared_memory import JobQueueItem, get_shared_memory
from servitor.database import database


@route("GET", r"^\/api/jobs/get_list$")
def jobs_get_list(ctx: http.server.BaseHTTPRequestHandler):
    query = parse_qs(urlparse(ctx.path).query)
    path = query["path"][0] if "path" in query else "."
    reply_json(ctx, 200, get_jobs(path))


@route("POST", r"^\/api/jobs/run$")
def jobs_run(ctx: http.server.BaseHTTPRequestHandler):
    query = parse_qs(urlparse(ctx.path).query)
    job_id = query["job_id"][0]
    execution_id = database.create_job_execution(job_id)
    get_shared_memory().job_queue.put(JobQueueItem(job_id, execution_id))
    reply_json(ctx, 200, {"status": "success"})


@route("GET", r"^\/api/jobs/executions/get_list$")
def jobs_executions_get_list(ctx: http.server.BaseHTTPRequestHandler):
    query = parse_qs(urlparse(ctx.path).query)
    reply_json(ctx, 200, database.get_job_executions(query["job_id"][0]))


@route("GET", r"^\/api/jobs/executions/get$")
def jobs_executions_get(ctx: http.server.BaseHTTPRequestHandler):
    query = parse_qs(urlparse(ctx.path).query)
    reply_json(
        ctx,
        200,
        database.get_job_execution(query["job_id"][0], query["execution_id"][0]),
    )


@route("GET", r"^\/api/jobs/executions/logs/get$")
def jobs_executions_logs_get(ctx: http.server.BaseHTTPRequestHandler):
    query = parse_qs(urlparse(ctx.path).query)
    reply(
        ctx,
        200,
        "text/plain",
        database.get_job_execution_log(query["job_id"][0], query["execution_id"][0]),
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


class HTTPRequestHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        handle_request(self, "GET")

    def do_POST(self):
        handle_request(self, "POST")

    def log_message(self, format, *args):
        log.debug(f"request {format % args}")
