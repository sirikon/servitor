import multiprocessing
import multiprocessing.connection

from servitor.framework.logging import log
from servitor.processes import handle_shutdown, start_job_worker, start_web_server
from servitor.shared_memory import SharedMemory, set_shared_memory
from servitor.event_bus import EventBus


def start():
    log.info("starting")
    multiprocessing.set_start_method("spawn")

    shared_memory = SharedMemory()
    set_shared_memory(shared_memory)

    event_bus = EventBus()

    processes = [
        multiprocessing.Process(
            target=start_web_server,
            args=(shared_memory, event_bus.spawn_client()),
            daemon=True,
        )
    ]

    for _ in range(1):
        processes.append(
            multiprocessing.Process(
                target=start_job_worker,
                args=(shared_memory, event_bus.spawn_client()),
                daemon=True,
            )
        )

    event_bus.start()

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


if __name__ == "__main__":
    start()
