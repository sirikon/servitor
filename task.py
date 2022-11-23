#!/usr/bin/env python3
import os

CTRL_DENO_ENTRY = os.path.abspath('controller/src/main.ts')
CTRL_DENO_EXEC_FLAGS = ['-A', '--unstable']
CTRL_DENO_CONFIG = ['--config', os.path.abspath('controller/deno.json')]
CTRL_DENO_IMPORT_MAP = [
    '--import-map',
    os.path.abspath('controller/import_map.json')]
CTRL_DENO_LOCK = ['--lock', os.path.abspath('controller/lock.json')]


def cli():

    @command
    def ui_start():
        if not os.path.isdir('ui/node_modules'):
            cmd('npm', 'i', cwd='ui')
        cmd('npm', 'exec', 'teseract', 'serve', cwd='ui')

    @command
    def ctrl_start(*args):
        cmd('mkdir', '-p', 'workdir')
        cmd('deno', 'run',
            *CTRL_DENO_EXEC_FLAGS,
            *CTRL_DENO_CONFIG,
            *CTRL_DENO_IMPORT_MAP,
            *CTRL_DENO_LOCK,
            CTRL_DENO_ENTRY, *args, cwd='workdir')

    @command
    def ctrl_cache():
        cmd('deno', 'cache',
            *CTRL_DENO_CONFIG,
            *CTRL_DENO_IMPORT_MAP,
            *CTRL_DENO_LOCK,
            CTRL_DENO_ENTRY)

    @command
    def ctrl_lock():
        cmd('deno', 'cache',
            *CTRL_DENO_CONFIG,
            *CTRL_DENO_IMPORT_MAP,
            *CTRL_DENO_LOCK,
            '--lock-write',
            CTRL_DENO_ENTRY)

    @command
    def fmt():
        cmd('deno', 'fmt', *CTRL_DENO_CONFIG, 'controller/src')
        cmd('npm', 'exec', 'teseract', 'lint', '--fix', cwd='ui')

    @command
    def lint():
        cmd('deno', 'lint', *CTRL_DENO_CONFIG, 'controller/src')
        cmd('npm', 'exec', 'teseract', 'lint', cwd='ui')

    @command
    def devenv():
        compose('up', '-d')

    @command
    def devenv_sh():
        compose('exec', 'controller', 'sh')


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
