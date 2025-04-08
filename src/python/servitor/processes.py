import queue
import signal
import threading
from time import sleep
from os import getcwd, makedirs, remove, chmod
from os.path import join, exists

from servitor.framework.logging import log
from servitor.framework.event_bus import EventBusClient, set_event_bus_client
from servitor.job_runner import run_job
from servitor.http import app
from servitor.shared_memory import JobQueueItem, SharedMemory, set_shared_memory


def handle_shutdown(handler):
    def shutdown_handler(sig, frame):
        log.info(f"received {signal.Signals(sig).name}")
        handler()

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)


def start_http_server(shared_memory: SharedMemory, event_bus_client: EventBusClient):
    set_shared_memory(shared_memory)
    set_event_bus_client(event_bus_client)
    event_bus_client.start()
    log.info("starting http server")
    sockets_dir = join(getcwd(), "sockets")
    makedirs(sockets_dir, exist_ok=True)
    sock_path = join(sockets_dir, "servitor.sock")
    if exists(sock_path):
        remove(sock_path)
    http_server = app.build_server(sock_path)
    thread = threading.Thread(target=http_server.serve_forever, args=(1,), daemon=True)
    thread.start()

    while True:
        if exists(sock_path):
            chmod(sockets_dir, 0o770)
            chmod(sock_path, 0o770)
            break
        sleep(0.1)

    def shutdown_handler():
        http_server.shutdown()

    handle_shutdown(shutdown_handler)
    thread.join()
    remove(sock_path)
    log.info("http server shutted down")


def start_job_worker(shared_memory: SharedMemory, event_bus_client: EventBusClient):
    set_shared_memory(shared_memory)
    set_event_bus_client(event_bus_client)
    event_bus_client.start()
    log.info("starting job worker")
    keep_alive = True

    def shutdown_handler():
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
