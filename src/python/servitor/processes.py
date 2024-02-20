import queue
import signal
import threading
from time import sleep
from os import getcwd, remove, chmod
from os.path import join, exists
from servitor.framework.http import UnixHTTPServer

from servitor.jobs import run_job
from servitor.framework.logging import log
from servitor.framework.http import HTTPRequestHandler
from servitor.http import configure_routes
from servitor.shared_memory import JobQueueItem, SharedMemory, set_shared_memory
from servitor.event_bus import EventBusClient


def handle_shutdown(handler):
    def shutdown_handler(sig, frame):
        log.info(f"received {signal.Signals(sig).name}")
        handler()

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)


def start_web_server(shared_memory: SharedMemory, event_bus: EventBusClient):
    set_shared_memory(shared_memory)
    log.info("starting web server")
    configure_routes()
    sock_path = join(getcwd(), "servitor.sock")
    if exists(sock_path):
        remove(sock_path)
    httpd = UnixHTTPServer(sock_path, HTTPRequestHandler)
    thread = threading.Thread(target=httpd.serve_forever, args=(1,), daemon=True)
    thread.start()

    while True:
        if exists(sock_path):
            chmod(sock_path, 0o770)
            break
        sleep(0.1)

    def shutdown_handler():
        log.info("asking web server to shut down")
        httpd.shutdown()

    handle_shutdown(shutdown_handler)
    event_bus.send("started http server")
    thread.join()
    remove(sock_path)
    log.info("http server shutted down")


def start_job_worker(shared_memory: SharedMemory, event_bus: EventBusClient):
    set_shared_memory(shared_memory)
    log.info("starting job worker")
    keep_alive = True

    @event_bus.listen
    def _(msg):
        log.info(f"new msg: {msg}")

    def shutdown_handler():
        log.info("asking job worker to shut down")
        nonlocal keep_alive
        keep_alive = False

    handle_shutdown(shutdown_handler)
    while keep_alive:
        try:
            item: JobQueueItem = shared_memory.job_queue.get(timeout=1)
            log.info("running job: " + item.job_id)
            run_job(item.job_id, item.execution_id)
        except queue.Empty:
            pass

    log.info("job worker shutted down")
