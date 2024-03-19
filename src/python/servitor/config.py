import json
from os import getcwd
from os.path import join, relpath, isfile
from glob import glob
from stat import S_IXUSR
from pathlib import Path

from servitor.paths import JobPathsBuilder


class Config:
    def get_jobs(self):
        def gen():
            for filename in glob(
                join(getcwd(), "config", "jobs", "**/*"), recursive=True
            ):
                if isfile(filename) and Path(filename).stat().st_mode & S_IXUSR:
                    job_id = relpath(filename, join(getcwd(), "config", "jobs"))
                    yield self.get_job(job_id)

        return sorted(list(gen()), key=lambda job: job["job_id"])

    def get_job(self, job_id: str):
        job_paths = JobPathsBuilder(getcwd(), job_id)
        try:
            with open(job_paths.input_spec_file, "r") as f:
                input_spec = json.load(f)
        except FileNotFoundError:
            input_spec = {}
        return {"job_id": job_id, "input_spec": input_spec}


config = Config()
