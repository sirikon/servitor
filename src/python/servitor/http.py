import http.server
import threading
import json
import time
from os import getcwd, sep, getenv
from mimetypes import guess_type
from os.path import join, normpath
from urllib.parse import urlparse, parse_qs

from servitor.framework.http import reply, reply_json, reply_not_found, route
from servitor.jobs import (
    get_jobs,
)
from servitor.paths import JobExecutionPathsBuilder, JobPathsBuilder
from servitor.shared_memory import JobQueueItem, get_shared_memory
from servitor.event_bus import get_event_bus_client
from servitor.database import database


def configure_routes():
    @route("GET", r"^/api/events$")
    def _(ctx: http.server.BaseHTTPRequestHandler):
        event_bus_client = get_event_bus_client()
        done = threading.Event()

        def on_message(msg):
            try:
                chunk = f"{json.dumps(msg, separators=(',', ':'))}\n"
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

    @route("GET", r"^/api/jobs/get_list$")
    def _(ctx: http.server.BaseHTTPRequestHandler):
        query = parse_qs(urlparse(ctx.path).query)
        path = query["path"][0] if "path" in query else "."
        reply_json(ctx, 200, get_jobs(path))

    @route("POST", r"^/api/jobs/run$")
    def _(ctx: http.server.BaseHTTPRequestHandler):
        query = parse_qs(urlparse(ctx.path).query)
        job_id = query["job_id"][0]
        execution_id = database.create_job_execution(job_id)
        get_shared_memory().job_queue.put(JobQueueItem(job_id, execution_id))
        reply_json(ctx, 200, {"status": "success"})

    @route("POST", r"^/api/jobs/executions/cancel$")
    def _(ctx: http.server.BaseHTTPRequestHandler):
        query = parse_qs(urlparse(ctx.path).query)
        job_id = query["job_id"][0]
        execution_id = query["execution_id"][0]
        get_event_bus_client().send(
            "job_execution_cancellation_requested",
            {"job_id": job_id, "execution_id": execution_id},
        )
        reply_json(ctx, 200, {"status": "success"})

    @route("GET", r"^/api/jobs/executions/get_list$")
    def _(ctx: http.server.BaseHTTPRequestHandler):
        query = parse_qs(urlparse(ctx.path).query)
        reply_json(ctx, 200, database.get_job_executions(query["job_id"][0]))

    @route("GET", r"^/api/jobs/executions/get$")
    def _(ctx: http.server.BaseHTTPRequestHandler):
        query = parse_qs(urlparse(ctx.path).query)
        reply_json(
            ctx,
            200,
            database.get_job_execution(query["job_id"][0], query["execution_id"][0]),
        )

    @route("GET", r"^/api/jobs/executions/logs/get$")
    def _(ctx: http.server.BaseHTTPRequestHandler):
        query = parse_qs(urlparse(ctx.path).query)
        job_id = query["job_id"][0]
        execution_id = query["execution_id"][0]
        job_paths = JobPathsBuilder(getcwd(), job_id)
        job_execution_paths = JobExecutionPathsBuilder(job_paths, execution_id)

        event_bus_client = get_event_bus_client()
        done = threading.Event()

        def on_message(msg):
            if (
                msg["id"] == "job_execution_status_changed"
                and msg["payload"]["job_id"] == job_id
                and msg["payload"]["execution_id"] == execution_id
            ):
                done.set()

        try:
            if database.get_job_execution_status(job_id, execution_id) != "running":
                done.set()
            if not done.is_set():
                event_bus_client.listen(on_message)
            with open(job_execution_paths.main_log_file, "br") as f:
                ctx.send_response(200)
                ctx.send_header("Content-Type", f"text/plain; charset=utf-8")
                ctx.send_header("Transfer-Encoding", "chunked")
                ctx.end_headers()
                while True:
                    chunk = f.read()
                    chunk_size = len(chunk)

                    if chunk_size > 0:
                        try:
                            ctx.wfile.write(f"{chunk_size:x}\r\n".encode())
                            ctx.wfile.write(chunk)
                            ctx.wfile.write(f"\r\n".encode())
                        except Exception:
                            break
                    if done.is_set():
                        try:
                            ctx.wfile.write(f"{0:x}\r\n\r\n".encode())
                        except Exception:
                            pass
                        break
                    time.sleep(0.1)
        except FileNotFoundError:
            reply_not_found(ctx)
        finally:
            event_bus_client.unlisten(on_message)

    ui_root = getenv("SERVITOR_UI_ROOT")
    if ui_root is not None:

        @route("GET", r"^/(?P<rest>.*)")
        def _(ctx: http.server.BaseHTTPRequestHandler, rest: str):
            if rest == "" or rest is None:
                rest = "index.html"
            base_path = normpath(ui_root)
            ui_file_path = normpath(join(base_path, rest))

            if not ui_file_path.startswith(base_path + sep):
                reply_not_found(ctx)
                return

            try:
                with open(ui_file_path, "br") as f:
                    reply(ctx, 200, guess_type(ui_file_path)[0], f.read())
            except FileNotFoundError:
                reply_not_found(ctx)
