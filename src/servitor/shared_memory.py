from dataclasses import dataclass
from multiprocessing import Queue, Lock

@dataclass
class JobQueueItem:
    job_id: str
    execution_id: str

class _SharedMemory:
    state_lock: Lock = None
    job_queue: Queue = None


shared_memory = _SharedMemory()
