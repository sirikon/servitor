from subprocess import run, DEVNULL
from os import getcwd, makedirs
from os.path import join


def run_job(path: str):
    job_path = join(getcwd(), "config", "jobs", path)
    job_status_path = join(getcwd(), "status", "jobs", path)
    log_file_path = join(job_status_path, "log.txt")

    makedirs(job_status_path, exist_ok=True)
    with open(log_file_path, "w") as log:
        run(
            [join(job_path, "run")],
            cwd=job_path,
            stdout=log,
            stderr=log,
            stdin=DEVNULL,
        )
