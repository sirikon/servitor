from subprocess import run, DEVNULL
from os import getcwd, makedirs, listdir
from os.path import join, exists, dirname, isdir

from servitor.shared_memory import shared_memory


class JobPathsBuilder:
    def __init__(self, root: str, job_id: str) -> None:
        self._root = root
        self._job_id = job_id

    @property
    def home(self):
        return join(self._root, "config", "jobs", self._job_id)

    @property
    def run_file(self):
        return join(self.home, "run")

    @property
    def executions_dir(self):
        return join(self._root, "state", "jobs", self._job_id, "executions")

    @property
    def last_execution_file(self):
        return join(self.executions_dir, "last_execution.txt")


class JobExecutionPathsBuilder:
    def __init__(self, job_paths: JobPathsBuilder, execution_id: str) -> None:
        self._job_paths = job_paths
        self._execution_id = execution_id

    @property
    def execution_dir(self):
        return join(self._job_paths.executions_dir, self._execution_id)

    @property
    def status_file(self):
        return join(self.execution_dir, "status.txt")

    @property
    def logs_dir(self):
        return join(self.execution_dir, "logs")

    @property
    def main_log_file(self):
        return join(self.logs_dir, "main.txt")


def create_job_execution(job_id: str):
    shared_memory.state_lock.acquire()
    try:
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
    finally:
        shared_memory.state_lock.release()


def get_job_execution_status(job_id: str, execution_id: str):
    job_paths = JobPathsBuilder(getcwd(), job_id)
    job_execution_paths = JobExecutionPathsBuilder(job_paths, execution_id)
    with open(job_execution_paths.status_file, "r") as f:
        return f.read()


def set_job_execution_status(job_id: str, execution_id: str, status: str):
    job_execution_paths = JobExecutionPathsBuilder(
        JobPathsBuilder(getcwd(), job_id), execution_id
    )
    makedirs(dirname(job_execution_paths.status_file), exist_ok=True)
    with open(job_execution_paths.status_file, "w") as f:
        f.write(status)


def run_job(job_id: str):
    execution_id = create_job_execution(job_id)
    job_paths = JobPathsBuilder(getcwd(), job_id)
    job_execution_paths = JobExecutionPathsBuilder(job_paths, execution_id)

    try:
        set_job_execution_status(job_id, execution_id, "running")
        makedirs(job_execution_paths.logs_dir, exist_ok=True)
        with open(job_execution_paths.main_log_file, "w") as log:
            run(
                [job_paths.run_file],
                cwd=job_paths.home,
                stdout=log,
                stderr=log,
                stdin=DEVNULL,
                check=True,
            )
    except Exception as ex:
        set_job_execution_status(job_id, execution_id, "failure")
        raise ex
    else:
        set_job_execution_status(job_id, execution_id, "success")


def get_job_executions(job_id: str):
    def gen():
        job_paths = JobPathsBuilder(getcwd(), job_id)
        for item in listdir(job_paths.executions_dir):
            if isdir(join(job_paths.executions_dir, item)):
                execution_id = item
                yield get_job_execution(job_id, execution_id)

    result = sorted(list(gen()), key=lambda x: int(x["execution_id"]), reverse=True)
    return result


def get_job_execution(job_id: str, execution_id: str):
    return {
        "execution_id": execution_id,
        "status": get_job_execution_status(job_id, execution_id),
    }


def get_job_execution_log(job_id: str, execution_id: str):
    job_paths = JobPathsBuilder(getcwd(), job_id)
    job_execution_paths = JobExecutionPathsBuilder(job_paths, execution_id)
    with open(job_execution_paths.main_log_file, "br") as f:
        return f.read()
