import multiprocessing


_job_queue = None


def set_job_queue(jq: multiprocessing.Queue):
    global _job_queue
    _job_queue = jq


def get_job_queue():
    global _job_queue
    return _job_queue
