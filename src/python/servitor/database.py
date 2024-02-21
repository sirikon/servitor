from os import getcwd, listdir, makedirs
from os.path import exists, dirname, isdir, join
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
        return {
            "execution_id": execution_id,
            "status": self.get_job_execution_status(job_id, execution_id),
        }

    def create_job_execution(self, job_id: str):
        shared_memory = get_shared_memory()
        shared_memory.state_lock.acquire()
        try:

            def creation():
                job_paths = JobPathsBuilder(getcwd(), job_id)
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
            return execution_id
        finally:
            shared_memory.state_lock.release()

    def get_job_execution_status(self, job_id: str, execution_id: str):
        job_paths = JobPathsBuilder(getcwd(), job_id)
        job_execution_paths = JobExecutionPathsBuilder(job_paths, execution_id)
        with open(job_execution_paths.status_file, "r") as f:
            return f.read()

    def set_job_execution_status(self, job_id: str, execution_id: str, status: str):
        job_execution_paths = JobExecutionPathsBuilder(
            JobPathsBuilder(getcwd(), job_id), execution_id
        )
        makedirs(dirname(job_execution_paths.status_file), exist_ok=True)
        with open(job_execution_paths.status_file, "w") as f:
            f.write(status)
        get_event_bus_client().send(
            "job_execution_status_changed",
            {"job_id": job_id, "execution_id": execution_id, "status": status},
        )

    def get_job_execution_log(self, job_id: str, execution_id: str):
        job_paths = JobPathsBuilder(getcwd(), job_id)
        job_execution_paths = JobExecutionPathsBuilder(job_paths, execution_id)
        with open(job_execution_paths.main_log_file, "br") as f:
            return f.read()


database = FileDatabase()
