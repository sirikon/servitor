import http.server
import threading
import json
import time
from os import getcwd, sep, getenv, name as os_name
from os.path import join, normpath
from urllib.parse import urlparse, parse_qs

from servitor.framework.event_bus import get_event_bus_client
from servitor.framework.http import (
    HTTPApp,
    reply_file,
    reply_json,
    reply_not_found,
)
from servitor.config import config
from servitor.paths import JobExecutionPathsBuilder, JobPathsBuilder
from servitor.shared_memory import JobQueueItem, get_shared_memory
from servitor.state import state

# Copied from shutil.
# https://github.com/python/cpython/blob/v3.12.2/Lib/shutil.py#L48
COPY_BUFSIZE = 1024 * 1024 if (os_name == "nt") else 64 * 1024


app = HTTPApp()


@app.route("GET", r"^/api/events$")
def _(ctx: http.server.BaseHTTPRequestHandler):
    event_bus_client = get_event_bus_client()
    done = threading.Event()

    def on_message(msg):
        try:
            chunk = f"{json.dumps(msg, separators=(',', ':'))}\n".encode()
            ctx.wfile.write(f"{len(chunk):x}\r\n".encode())
            ctx.wfile.write(chunk)
            ctx.wfile.write("\r\n".encode())
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


@app.route("GET", r"^/api/jobs/get_list$")
def _(ctx: http.server.BaseHTTPRequestHandler):
    reply_json(ctx, 200, config.get_jobs())


@app.route("GET", r"^/api/jobs/get$")
def _(ctx: http.server.BaseHTTPRequestHandler):
    query = parse_qs(urlparse(ctx.path).query)
    job_id = query["job_id"][0]
    reply_json(ctx, 200, config.get_job(job_id))


@app.route("POST", r"^/api/jobs/run$")
def _(ctx: http.server.BaseHTTPRequestHandler):
    query = parse_qs(urlparse(ctx.path).query)
    job_id = query["job_id"][0]
    job_paths = JobPathsBuilder(getcwd(), job_id)

    try:
        with open(job_paths.input_spec_file, "r") as f:
            input_spec = json.load(f)
    except FileNotFoundError:
        input_spec = {}
    input_values = {}
    for key in query:
        if key.startswith("input_value_"):
            input_key = key.removeprefix("input_value_")
            if input_key in input_spec:
                input_values[input_key] = query[key][0]

    execution_id = state.create_job_execution(job_id, input_values)
    get_shared_memory().job_queue.put(JobQueueItem(job_id, execution_id))
    reply_json(ctx, 200, {"status": "success"})


@app.route("POST", r"^/api/jobs/executions/cancel$")
def _(ctx: http.server.BaseHTTPRequestHandler):
    query = parse_qs(urlparse(ctx.path).query)
    job_id = query["job_id"][0]
    execution_id = query["execution_id"][0]
    get_event_bus_client().send(
        "job_execution_cancellation_requested",
        {"job_id": job_id, "execution_id": execution_id},
    )
    reply_json(ctx, 200, {"status": "success"})


@app.route("GET", r"^/api/jobs/executions/get_list$")
def _(ctx: http.server.BaseHTTPRequestHandler):
    query = parse_qs(urlparse(ctx.path).query)
    reply_json(ctx, 200, state.get_job_executions(query["job_id"][0]))


@app.route("GET", r"^/api/jobs/executions/get$")
def _(ctx: http.server.BaseHTTPRequestHandler):
    query = parse_qs(urlparse(ctx.path).query)
    reply_json(
        ctx,
        200,
        state.get_job_execution(query["job_id"][0], query["execution_id"][0]),
    )


@app.route("GET", r"^/api/jobs/executions/logs/get$")
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
        event_bus_client.listen(on_message)
        if state.get_job_execution_status(job_id, execution_id) != "running":
            done.set()
        with open(job_execution_paths.main_log_file, "br") as f:
            ctx.send_response(200)
            ctx.send_header("Content-Type", f"text/plain; charset=utf-8")
            ctx.send_header("Transfer-Encoding", "chunked")
            ctx.end_headers()

            while True:

                try:
                    while chunk := f.read(COPY_BUFSIZE):
                        ctx.wfile.write(f"{len(chunk):x}\r\n".encode())
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

    @app.route("GET", r"^/(?P<rest>.*)")
    def _(ctx: http.server.BaseHTTPRequestHandler, rest: str):
        if rest == "" or rest is None:
            rest = "index.html"
        base_path = normpath(ui_root)
        ui_file_path = normpath(join(base_path, rest))

        if not ui_file_path.startswith(base_path + sep):
            reply_not_found(ctx)
            return

        try:
            reply_file(ctx, 200, ui_file_path)
        except FileNotFoundError:
            reply_not_found(ctx)
