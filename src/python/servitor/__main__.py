import multiprocessing
import multiprocessing.connection

from servitor.framework.logging import log
from servitor.framework.event_bus import EventBus
from servitor.processes import handle_shutdown, start_job_worker, start_http_server
from servitor.shared_memory import SharedMemory, set_shared_memory


def start():
    log.info("starting")
    multiprocessing.set_start_method("spawn")

    shared_memory = SharedMemory()
    set_shared_memory(shared_memory)

    event_bus = EventBus()

    processes = [
        multiprocessing.Process(
            name="HTTP_Server",
            target=start_http_server,
            args=(shared_memory, event_bus.spawn_client()),
            daemon=True,
        )
    ]

    for i in range(max(multiprocessing.cpu_count(), 2)):
        processes.append(
            multiprocessing.Process(
                name=f"Job_Worker-{i+1}",
                target=start_job_worker,
                args=(shared_memory, event_bus.spawn_client()),
                daemon=True,
            )
        )

    for process in processes:
        process.start()

    def shutdown_handler():
        for process in processes:
            process.terminate()

    handle_shutdown(shutdown_handler)

    for process in processes:
        process.join()

    log.info("shutting down")


if __name__ == "__main__":
    start()
