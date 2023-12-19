import http.server
import multiprocessing
import queue
import signal
import threading
from servitor.jobs import run_job

from servitor.logging import log
from servitor.http import HTTPRequestHandler
from servitor.shared_memory import shared_memory


def handle_shutdown(handler):
    def shutdown_handler(sig, frame):
        log.info(f"received {signal.Signals(sig).name}")
        handler()

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)


def start_web_server(
    job_queue: multiprocessing.Queue, state_lock: multiprocessing.Lock
):
    shared_memory.state_lock = state_lock
    shared_memory.job_queue = job_queue
    log.info("starting web server")
    httpd = http.server.HTTPServer(("", 40000), HTTPRequestHandler)
    thread = threading.Thread(target=httpd.serve_forever, args=(1,), daemon=True)
    thread.start()

    def shutdown_handler():
        log.info("asking web server to shut down")
        httpd.shutdown()

    handle_shutdown(shutdown_handler)
    thread.join()
    log.info("http server shutted down")


def start_job_worker(
    job_queue: multiprocessing.Queue, state_lock: multiprocessing.Lock
):
    shared_memory.state_lock = state_lock
    shared_memory.job_queue = job_queue
    log.info("starting job worker")
    keep_alive = True

    def shutdown_handler():
        log.info("asking job worker to shut down")
        nonlocal keep_alive
        keep_alive = False

    handle_shutdown(shutdown_handler)
    while keep_alive:
        try:
            data = job_queue.get(timeout=1)
            log.info("running job: " + data)
            run_job(data)
        except queue.Empty:
            pass

    log.info("job worker shutted down")
