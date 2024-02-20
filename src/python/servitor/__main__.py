import multiprocessing
import multiprocessing.connection
import threading

from servitor.framework.logging import log
from servitor.processes import handle_shutdown, start_job_worker, start_web_server
from servitor.shared_memory import SharedMemory, set_shared_memory


def start():
    log.info("starting")
    multiprocessing.set_start_method("spawn")

    shared_memory = SharedMemory()
    set_shared_memory(shared_memory)

    connections = []
    processes = []

    web_conn, web_root_conn = multiprocessing.Pipe()
    connections.append(web_root_conn)
    processes.append(
        multiprocessing.Process(
            target=start_web_server, args=(shared_memory, web_conn), daemon=True
        )
    )

    for _ in range(max(multiprocessing.cpu_count(), 2)):
        worker_conn, worker_root_conn = multiprocessing.Pipe()
        connections.append(worker_root_conn)
        processes.append(
            multiprocessing.Process(
                target=start_job_worker, args=(shared_memory, worker_conn), daemon=True
            )
        )

    for connection in connections:
        thread = threading.Thread(
            target=broadcast, args=(connection, connections), daemon=True
        )
        thread.start()

    for process in processes:
        process.start()

    def shutdown_handler():
        log.info("shutting down everything")
        for process in processes:
            process.terminate()

    handle_shutdown(shutdown_handler)

    for process in processes:
        process.join()

    log.info("shutting down")


def broadcast(
    conn: multiprocessing.connection.Connection,
    conns: list[multiprocessing.connection.Connection],
):
    try:
        while True:
            msg = conn.recv()
            for c in conns:
                if c is not conn:
                    c.send(msg)
    except EOFError:
        log.info("pipe closed")


if __name__ == "__main__":
    start()
