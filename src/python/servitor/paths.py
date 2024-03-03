from os.path import join, dirname


class JobPathsBuilder:
    def __init__(self, root: str, job_id: str) -> None:
        self._root = root
        self._job_id = job_id

    @property
    def run_file(self):
        return join(self._root, "config", "jobs", self._job_id)

    @property
    def input_spec_file(self):
        return f"{self.run_file}.input.json"

    @property
    def home(self):
        return dirname(self.run_file)

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
    def input_values_file(self):
        return join(self.execution_dir, "input.json")

    @property
    def status_history_file(self):
        return join(self.execution_dir, "status_history.tsv")

    @property
    def result_file(self):
        return join(self.execution_dir, "result.tsv")

    @property
    def logs_dir(self):
        return join(self.execution_dir, "logs")

    @property
    def main_log_file(self):
        return join(self.logs_dir, "main.txt")
