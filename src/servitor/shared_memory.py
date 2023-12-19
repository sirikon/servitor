from multiprocessing import Queue, Lock


class _SharedMemory:
    state_lock: Lock = None
    job_queue: Queue = None


shared_memory = _SharedMemory()
