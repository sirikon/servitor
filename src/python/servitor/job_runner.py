import json
from signal import SIGINT
from subprocess import Popen, DEVNULL
from os import getcwd, makedirs, killpg, environ

from servitor.framework.event_bus import get_event_bus_client
from servitor.paths import JobExecutionPathsBuilder, JobPathsBuilder
from servitor.state import state


def run_job(job_id: str, execution_id: str):
    job_paths = JobPathsBuilder(getcwd(), job_id)
    job_execution_paths = JobExecutionPathsBuilder(job_paths, execution_id)
    with open(job_execution_paths.input_values_file, "r") as f:
        input_values = json.load(f)
    event_bus_client = get_event_bus_client()

    process: Popen = None
    cancelled: bool = False
    status: str = None
    result_exit_code: int = None
    result_message: str = None

    def listen_for_cancellation(msg):
        if (
            msg["id"] == "job_execution_cancellation_requested"
            and msg["payload"]["job_id"] == job_id
            and msg["payload"]["execution_id"] == execution_id
        ):
            nonlocal cancelled
            cancelled = True
            killpg(process.pid, SIGINT)

    event_bus_client.listen(listen_for_cancellation)
    try:
        makedirs(job_execution_paths.logs_dir, exist_ok=True)
        with open(job_execution_paths.main_log_file, "w") as job_log:
            process = Popen(
                [job_paths.run_file],
                cwd=job_paths.home,
                stdout=job_log,
                stderr=job_log,
                stdin=DEVNULL,
                start_new_session=True,
                env=dict(environ, **input_values),
            )
            state.set_job_execution_status(job_id, execution_id, "running")
            exit_code = process.wait()
    except Exception as ex:
        status = "failure"
        result_exit_code = -1
        result_message = str(ex)
    else:
        if cancelled:
            status = "cancelled"
        elif exit_code > 0:
            status = "failure"
        else:
            status = "success"
        result_exit_code = exit_code
        result_message = ""
    finally:
        event_bus_client.unlisten(listen_for_cancellation)
        state.set_job_execution_status(job_id, execution_id, status)
        state.set_job_execution_result(
            job_id, execution_id, result_exit_code, result_message
        )
