import json
from datetime import datetime, timezone

from os import getcwd, listdir, makedirs
from os.path import exists, dirname, isdir, join
from typing import Any
from servitor.paths import JobExecutionPathsBuilder, JobPathsBuilder
from servitor.shared_memory import get_shared_memory
from servitor.event_bus import get_event_bus_client


class FileDatabase:
    def get_job_executions(self, job_id: str):
        def gen():
            job_paths = JobPathsBuilder(getcwd(), job_id)
            if not exists(job_paths.executions_dir):
                return
            for item in listdir(job_paths.executions_dir):
                if isdir(join(job_paths.executions_dir, item)):
                    execution_id = item
                    yield self.get_job_execution(job_id, execution_id)

        result = sorted(list(gen()), key=lambda x: int(x["execution_id"]), reverse=True)
        return result

    def get_job_execution(self, job_id: str, execution_id: str):
        job_paths = JobPathsBuilder(getcwd(), job_id)
        job_execution_paths = JobExecutionPathsBuilder(job_paths, execution_id)
        try:
            with open(job_execution_paths.input_values_file, "r") as f:
                input_values = json.load(f)
        except FileNotFoundError:
            input_values = {}
        return {
            "execution_id": execution_id,
            "status": self.get_job_execution_status(job_id, execution_id),
            "status_history": self.get_job_execution_status_history(
                job_id, execution_id
            ),
            "result": self.get_job_execution_result(job_id, execution_id),
            "input_values": input_values,
        }

    def create_job_execution(self, job_id: str, input_values: Any):
        shared_memory = get_shared_memory()
        with shared_memory.state_lock:
            job_paths = JobPathsBuilder(getcwd(), job_id)

            def creation():
                makedirs(job_paths.executions_dir, exist_ok=True)
                if exists(job_paths.last_execution_file):
                    with open(job_paths.last_execution_file, "r+") as f:
                        last_execution = int(f.read())
                        new_execution = str(last_execution + 1)
                        f.seek(0)
                        f.write(new_execution)
                    return new_execution
                else:
                    first_execution = "1"
                    with open(job_paths.last_execution_file, "w") as f:
                        f.write(first_execution)
                return first_execution

            execution_id = creation()
            self.set_job_execution_status(job_id, execution_id, "created")
            job_execution_paths = JobExecutionPathsBuilder(job_paths, execution_id)
            with open(job_execution_paths.input_values_file, "w") as f:
                f.write(json.dumps(input_values, indent=2) + "\n")
            return execution_id

    def get_job_execution_status_history(self, job_id: str, execution_id: str):
        job_paths = JobPathsBuilder(getcwd(), job_id)
        job_execution_paths = JobExecutionPathsBuilder(job_paths, execution_id)
        with open(job_execution_paths.status_history_file, "r") as f:
            return [
                {"timestamp": l[0], "status": l[1].strip()}
                for l in [l.split("\t") for l in f.readlines()]
            ]

    def get_job_execution_status(self, job_id: str, execution_id: str):
        return self.get_job_execution_status_history(job_id, execution_id)[-1]["status"]

    def set_job_execution_status(self, job_id: str, execution_id: str, status: str):
        shared_memory = get_shared_memory()
        with shared_memory.state_lock:
            timestamp = datetime.now(tz=timezone.utc).isoformat()
            job_execution_paths = JobExecutionPathsBuilder(
                JobPathsBuilder(getcwd(), job_id), execution_id
            )
            makedirs(dirname(job_execution_paths.status_history_file), exist_ok=True)
            with open(job_execution_paths.status_history_file, "a") as f:
                f.write(f"{timestamp}\t{status}\n")
            get_event_bus_client().send(
                "job_execution_status_changed",
                {"job_id": job_id, "execution_id": execution_id, "status": status},
            )

    def set_job_execution_result(
        self, job_id: str, execution_id: str, exit_code: int, message: str | None
    ):
        shared_memory = get_shared_memory()
        with shared_memory.state_lock:
            job_execution_paths = JobExecutionPathsBuilder(
                JobPathsBuilder(getcwd(), job_id), execution_id
            )
            with open(job_execution_paths.result_file, "w") as f:
                f.write(f"{exit_code}\t{message}\n")

    def get_job_execution_result(self, job_id: str, execution_id: str):
        job_execution_paths = JobExecutionPathsBuilder(
            JobPathsBuilder(getcwd(), job_id), execution_id
        )
        try:
            with open(job_execution_paths.result_file, "r") as f:
                [exit_code, message] = f.read().split("\t")
                return {"exit_code": int(exit_code), "message": message.strip()}
        except FileNotFoundError:
            return None

    def get_job_execution_log(self, job_id: str, execution_id: str):
        job_paths = JobPathsBuilder(getcwd(), job_id)
        job_execution_paths = JobExecutionPathsBuilder(job_paths, execution_id)
        with open(job_execution_paths.main_log_file, "br") as f:
            return f.read()


database = FileDatabase()
