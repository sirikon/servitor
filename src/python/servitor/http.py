import http.server
import threading
from os import sep, getenv
from mimetypes import guess_type
from os.path import join, normpath
from time import sleep
from urllib.parse import urlparse, parse_qs

from servitor.framework.http import reply, reply_json, route
from servitor.jobs import (
    get_jobs,
)
from servitor.framework.logging import log
from servitor.shared_memory import JobQueueItem, get_shared_memory
from servitor.event_bus import get_event_bus_client
from servitor.database import database


def configure_routes():
    @route("GET", r"^\/api/events$")
    def _(ctx: http.server.BaseHTTPRequestHandler):
        event_bus_client = get_event_bus_client()
        done = threading.Event()

        def on_message(msg):
            log.info(f"handling msg: {msg}")
            try:
                chunk = f"{msg}\n"
                chunk_size = len(chunk.encode())
                ctx.wfile.write(f"{chunk_size:x}\r\n{chunk}\r\n".encode())
            except Exception:
                done.set()

        try:
            ctx.send_response(200)
            ctx.send_header("Content-Type", f"text/plain; charset=utf-8")
            ctx.send_header("Transfer-Encoding", "chunked")
            ctx.end_headers()
            event_bus_client.listen(on_message)
            done.wait()
        finally:
            event_bus_client.unlisten(on_message)

    @route("GET", r"^\/api/jobs/get_list$")
    def _(ctx: http.server.BaseHTTPRequestHandler):
        query = parse_qs(urlparse(ctx.path).query)
        path = query["path"][0] if "path" in query else "."
        reply_json(ctx, 200, get_jobs(path))

    @route("POST", r"^\/api/jobs/run$")
    def _(ctx: http.server.BaseHTTPRequestHandler):
        query = parse_qs(urlparse(ctx.path).query)
        job_id = query["job_id"][0]
        execution_id = database.create_job_execution(job_id)
        get_shared_memory().job_queue.put(JobQueueItem(job_id, execution_id))
        reply_json(ctx, 200, {"status": "success"})

    @route("POST", r"^\/api/jobs/executions/cancel$")
    def _(ctx: http.server.BaseHTTPRequestHandler):
        query = parse_qs(urlparse(ctx.path).query)
        job_id = query["job_id"][0]
        execution_id = query["execution_id"][0]
        get_event_bus_client().send(f"cancel_{job_id}_{execution_id}")
        reply_json(ctx, 200, {"status": "success"})

    @route("GET", r"^\/api/jobs/executions/get_list$")
    def _(ctx: http.server.BaseHTTPRequestHandler):
        query = parse_qs(urlparse(ctx.path).query)
        reply_json(ctx, 200, database.get_job_executions(query["job_id"][0]))

    @route("GET", r"^\/api/jobs/executions/get$")
    def _(ctx: http.server.BaseHTTPRequestHandler):
        query = parse_qs(urlparse(ctx.path).query)
        reply_json(
            ctx,
            200,
            database.get_job_execution(query["job_id"][0], query["execution_id"][0]),
        )

    @route("GET", r"^\/api/jobs/executions/logs/get$")
    def _(ctx: http.server.BaseHTTPRequestHandler):
        query = parse_qs(urlparse(ctx.path).query)
        reply(
            ctx,
            200,
            "text/plain",
            database.get_job_execution_log(
                query["job_id"][0], query["execution_id"][0]
            ),
        )

    ui_root = getenv("SERVITOR_UI_ROOT")
    if ui_root is not None:

        @route("GET", r"^\/ui$")
        def _(ctx: http.server.BaseHTTPRequestHandler):
            ctx.send_response(302)
            ctx.send_header("Location", "/ui/")
            ctx.end_headers()

        @route("GET", r"^\/ui/(?P<rest>.*)")
        def _(ctx: http.server.BaseHTTPRequestHandler, rest: str = "index.html"):
            if rest == "":
                rest = "index.html"
            base_path = normpath(ui_root)
            ui_file_path = normpath(join(base_path, rest))

            if not ui_file_path.startswith(base_path + sep):
                reply(ctx, 404, "text/plain", b"")
                return

            with open(ui_file_path, "br") as f:
                reply(ctx, 200, guess_type(ui_file_path)[0], f.read())
