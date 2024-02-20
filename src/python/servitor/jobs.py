from subprocess import Popen, DEVNULL
from os import getcwd, makedirs
from os.path import join, dirname, relpath
from glob import glob
from stat import S_IXUSR
from pathlib import Path

from servitor.paths import JobExecutionPathsBuilder, JobPathsBuilder
from servitor.database import database


def get_jobs(path: str):
    def gen():
        for filename in glob(
            join(getcwd(), "config", "jobs", path, "**/run"), recursive=True
        ):
            if Path(filename).stat().st_mode & S_IXUSR:
                job_id = dirname(
                    relpath(filename, join(getcwd(), "config", "jobs", path))
                )
                yield {"job_id": job_id}

    return list(gen())


def run_job(job_id: str, execution_id: str):
    job_paths = JobPathsBuilder(getcwd(), job_id)
    job_execution_paths = JobExecutionPathsBuilder(job_paths, execution_id)

    try:
        database.set_job_execution_status(job_id, execution_id, "running")
        makedirs(job_execution_paths.logs_dir, exist_ok=True)
        with open(job_execution_paths.main_log_file, "w") as log:
            process = Popen(
                [job_paths.run_file],
                cwd=job_paths.home,
                stdout=log,
                stderr=log,
                stdin=DEVNULL,
            )
            exit_code = process.wait()
    except Exception as ex:
        database.set_job_execution_status(job_id, execution_id, "failure")
        raise ex
    else:
        status = "success" if exit_code == 0 else "failure"
        database.set_job_execution_status(job_id, execution_id, status)
