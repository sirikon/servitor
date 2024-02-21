# Servitor

Simplest possible job manager.

## How it works

Any subdirectory under `<working_directory>/config/jobs` with an executable file called `run` inside will be considered a **job**. Jobs are **executed** by executing the `run` file in its own directory. The logs of the execution are captured and stored.

The default UI and the HTTP API allow exploring jobs, executions, logs, and triggering new executions.

### Important technical details

Jobs are executed with the same environment and user used to start servitor. For example: Starting Servitor with the `root` user means that the jobs execute as `root` aswell, without limitations. Plan accordingly.

Servitor exposes an HTTP API through a UNIX socket on `<working_directory>/servitor.sock`. Servitor implements no authentication nor authorization of any kind, which means that a process that can communicate with `servitor.sock` can do anything that the API allows, unrestricted. This socket is created with the permissions `770` to limit the access to the same user and group executing Servitor.

## Install

### Manual

Servitor depends exclusively on Python 3 and makes no assumptions on how your system works. You can clone this repository, run the command below, and you will have a UNIX socket in `servitor.sock` ready to accept HTTP requests.

```bash
PYTHONPATH=src/python SERVITOR_UI_ROOT=src/ui python3 -m servitor
```

### Installer

There is an [installer](./scripts/servitor-installer.sh) available that will install servitor as a service, create a user if needed, and leave it running.

```bash
curl -L https://raw.githubusercontent.com/sirikon/servitor/master/scripts/servitor-installer.sh | bash
```

It makes some assumptions about your system. If those work for you, use it. If not, go the manual way.

To update a Servitor installation, just run the installer again with the same parameters.

Available environment variables to configure the installer at execution:

- `SERVITOR_USER` (default: `root`): Change the user that will run the servitor systemd service. It will create the user if it doesn't exist yet.

## Configure

Available environment variables to configure servitor at execution:

- `SERVITOR_UI_ROOT` (default: _empty_): If defined, the specified filesystem path is served under the root HTTP path (`/`). This is intended to provide a way to serve alternative UIs or to disable the UI completely. If the environment variable stays undefined, no UI will be served at the root HTTP path, and the server will reply with `404 Not Found`.
