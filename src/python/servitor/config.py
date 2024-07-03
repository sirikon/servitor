import json
from os import getcwd
from os.path import join, relpath, isfile
from glob import glob
from stat import S_IXUSR
from pathlib import Path

from servitor.paths import JobPathsBuilder


class Config:
    def get_jobs(self):
        with open("config.json", "r") as f:
            config = json.load(f)

        result = []
        for job_id, spec in config["jobs"].items():
            result.append(
                {
                    "job_id": job_id,
                    "command": spec["command"],
                    "workdir": getcwd(),
                    "input_spec": {},
                }
            )
        return result

    def get_job(self, job_id: str):
        jobs = self.get_jobs()
        for job in jobs:
            if job["job_id"] == job_id:
                return job
        return None


config = Config()
