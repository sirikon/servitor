#!/usr/bin/env python3
from os.path import abspath, join
import os

CTRL_HOME = abspath(join('modules', 'controller'))
CTRL_ENTRY = join(CTRL_HOME, 'src', 'main.ts')
CTRL_EXEC_FLAGS = ['-A', '--unstable']
CTRL_CONFIG = ['--config', join(CTRL_HOME, 'deno.json')]

UI_HOME = abspath(join('modules', 'ui'))

DOCKER_HOME = abspath('docker')

WORKDIR = abspath('workdir')


def cli():

    @command
    def ui_start():
        if not os.path.isdir(join(UI_HOME, 'node_modules')):
            cmd('npm', 'i', cwd=UI_HOME)
        cmd('npm', 'exec', 'teseract', 'serve', cwd=UI_HOME)

    @command
    def ctrl_start(*args):
        cmd('mkdir', '-p', WORKDIR)
        cmd('deno', 'run',
            *CTRL_EXEC_FLAGS,
            *CTRL_CONFIG,
            '--cached-only',
            CTRL_ENTRY,
            *args, cwd=WORKDIR)

    @command
    def ctrl_cache():
        cmd('deno', 'cache',
            *CTRL_CONFIG,
            '--lock-write',
            CTRL_ENTRY)

    @command
    def fmt():
        cmd('deno', 'fmt', *CTRL_CONFIG, cwd=CTRL_HOME)
        cmd('npm', 'exec', 'teseract', 'lint', '--fix', cwd=UI_HOME)

    @command
    def lint():
        cmd('deno', 'lint', *CTRL_CONFIG, cwd=CTRL_HOME)
        cmd('npm', 'exec', 'teseract', 'lint', cwd=UI_HOME)

    @command
    def devenv():
        compose('up', '-d')

    @command
    def devenv_sh():
        compose('exec', 'controller', 'sh')

    @command
    def compose(*args):
        cmd('docker', 'compose',
            '-p', 'servitor-devenv',
            '--project-directory', abspath('.'),
            '-f', join(DOCKER_HOME, 'docker-compose.yml'),
            *args)



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
