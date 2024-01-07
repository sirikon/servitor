from dataclasses import dataclass
import multiprocessing


@dataclass
class JobQueueItem:
    job_id: str
    execution_id: str


class SharedMemory:
    state_lock: multiprocessing.Lock
    job_queue: multiprocessing.Queue

    def __init__(self) -> None:
        self.state_lock = multiprocessing.Lock()
        self.job_queue = multiprocessing.Queue()


_shared_memory: SharedMemory | None = None


def set_shared_memory(shared_memory: SharedMemory):
    global _shared_memory
    _shared_memory = shared_memory


def get_shared_memory() -> SharedMemory:
    return _shared_memory
