# Servitor

Simplest possible automation server.

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

Available environment variables to configure the installer at execution:

- `SERVITOR_USER` (default: `root`): Change the user that will run the servitor systemd service. It will create the user if it doesn't exist yet.

## Configure

Available environment variables to configure servitor at execution:

- `SERVITOR_UI_ROOT` (default: _empty_): If defined, the specified filesystem path is served under the `/ui` HTTP path. No `/ui` HTTP path will be available unless this environment variable is defined.
