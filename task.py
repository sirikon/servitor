#!/usr/bin/env python3
import os

SERVER_DENO_ENTRY = os.path.abspath('server/src/main.ts')
SERVER_DENO_EXEC_FLAGS = ['-A', '--unstable']
SERVERDENO_CONFIG = ['--config', os.path.abspath('server/deno.json')]
SERVER_DENO_IMPORT_MAP = [
    '--import-map',
    os.path.abspath('server/import_map.json')]
SERVER_DENO_LOCK = ['--lock', os.path.abspath('server/lock.json')]


def cli():

    @command
    def fe_start():
        if not os.path.isdir('frontend/node_modules'):
            cmd('npm', 'i', cwd='frontend')
        cmd('npm', 'exec', 'teseract', 'serve', cwd='frontend')

    @command
    def sv_start(*args):
        cmd('mkdir', '-p', 'workdir')
        cmd('deno', 'run',
            *SERVER_DENO_EXEC_FLAGS,
            *SERVERDENO_CONFIG,
            *SERVER_DENO_IMPORT_MAP,
            *SERVER_DENO_LOCK,
            SERVER_DENO_ENTRY, *args, cwd='workdir')

    @command
    def sv_cache():
        cmd('deno', 'cache',
            *SERVERDENO_CONFIG,
            *SERVER_DENO_IMPORT_MAP,
            *SERVER_DENO_LOCK,
            SERVER_DENO_ENTRY)

    @command
    def sv_lock():
        cmd('deno', 'cache',
            *SERVERDENO_CONFIG,
            *SERVER_DENO_IMPORT_MAP,
            *SERVER_DENO_LOCK,
            '--lock-write',
            SERVER_DENO_ENTRY)

    @command
    def fmt():
        cmd('deno', 'fmt', *SERVERDENO_CONFIG, 'server/src')
        cmd('npm', 'exec', 'teseract', 'lint', '--fix', cwd='frontend')

    @command
    def lint():
        cmd('deno', 'lint', *SERVERDENO_CONFIG, 'server/src')
        cmd('npm', 'exec', 'teseract', 'lint', cwd='frontend')

    @command
    def devenv():
        compose('up', '-d')

    @command
    def devenv_sh():
        compose('exec', 'server', 'sh')


def compose(*args):
    cmd('docker', 'compose',
        '-p', 'servitor-devenv',
        '--project-directory', '.',
        '-f', './docker/docker-compose.yml', *args)



# fmt: off
# https://gist.github.com/sirikon/d4327b6cc3de5cc244dbe5529d8f53ae
import inspect, sys, os, subprocess; os.chdir(os.path.dirname(__file__));commands = []
def cmd(*args, **kwargs): return subprocess.run(args, **kwargs, check=True)
def spec(f): return inspect.getfullargspec(f)
def command(func): commands.append(func); return func
cli(); args = sys.argv[1:]
if len(args) == 0: print("Available commands:"); [print(' '.join([
    f' {f.__name__}',
    *[f'<{a}>' for a in spec(f).args],
    *([f'<...{spec(f).varargs}>'] if spec(f).varargs is not None else [])
])) for f in commands]; exit(0)
matching_commands = [f for f in commands if f.__name__ == args[0]]
if len(matching_commands) == 0: print(f'Unknown command "{args[0]}"');sys.exit(1)
try: matching_commands[0](*args[1:])
except KeyboardInterrupt: pass
except subprocess.CalledProcessError as err: sys.exit(err.returncode)
