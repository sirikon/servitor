from signal import SIGINT
from subprocess import Popen, DEVNULL
from os import getcwd, makedirs, killpg
from os.path import join, dirname, relpath
from glob import glob
from stat import S_IXUSR
from pathlib import Path

from servitor.paths import JobExecutionPathsBuilder, JobPathsBuilder
from servitor.database import database
from servitor.event_bus import get_event_bus_client


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
    event_bus_client = get_event_bus_client()

    process: Popen = None
    final_status: str = None

    def listen_for_cancellation(msg):
        if (
            msg["id"] == "job_execution_cancellation_requested"
            and msg["payload"]["job_id"] == job_id
            and msg["payload"]["execution_id"] == execution_id
        ):
            killpg(process.pid, SIGINT)

    event_bus_client.listen(listen_for_cancellation)
    try:
        database.set_job_execution_status(job_id, execution_id, "running")
        makedirs(job_execution_paths.logs_dir, exist_ok=True)
        with open(job_execution_paths.main_log_file, "w") as job_log:
            process = Popen(
                [job_paths.run_file],
                cwd=job_paths.home,
                stdout=job_log,
                stderr=job_log,
                stdin=DEVNULL,
                start_new_session=True,
            )
            exit_code = process.wait()
    except Exception as ex:
        final_status = "failure"
        database.set_job_execution_status(job_id, execution_id, "failure")
        raise ex
    else:
        final_status = "success" if exit_code == 0 else "failure"

    finally:
        event_bus_client.unlisten(listen_for_cancellation)
        database.set_job_execution_status(job_id, execution_id, final_status)
        event_bus_client.send(
            "job_execution_finished",
            {"job_id": job_id, "execution_id": execution_id, "status": final_status},
        )
