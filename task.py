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
    def prepare():
        cmd('npm', 'install', cwd=UI_HOME)
        cmd('deno', 'cache', *CTRL_CONFIG, CTRL_ENTRY)

    @command
    def ui_start():
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
    def ctrl_lock():
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
import inspect, sys, os, subprocess, re;commands = [];args = sys.argv[1:]
def _c(c): return f'\x1b[{c}m' # Change to `return ''` to disable colors
def cmd(*args, check=True, **k): return subprocess.run(args, check=check, **k)
def command(func): commands.append(func); return func
def _default(i, spec): d=spec.defaults;m=len(spec.args)-len(d or []);return\
    (True,f'={d[i-m]}'if d[i-m]is not None else'') if i >= m else (False,'')
def _ri(s, n): s=re.sub('^[ ]*\n', '', s);s=re.sub('\n[ ]*$', '', s);\
    ls=s.split('\n');i=len(re.match('(^[ ]*)', ls[0]).group(0));\
    return '\n'.join((n * ' ') + re.sub(f'^[ ]{{{i}}}', '', l) for l in ls)
os.chdir(os.path.dirname(__file__));cli()
if len(args) == 0: print(f"{_c(1)}commands:{_c(0)}"); [print(' '.join([
    f'  {_c(96)}{f.__name__}{_c(0)}',
    *[f'{_c(36)}({a}{d[1]}){_c(0)}' if d[0] else f'{_c(36)}[{a}]{_c(0)}' \
        for a,d in ((a,_default(i, spec)) for i, a in enumerate(spec.args))],
    *([f'[...{spec.varargs}]'] if spec.varargs is not None else []),
    *([f'\n{_c(2)}{_ri(f.__doc__, 4)}{_c(0)}'] if f.__doc__ else [])
]))for spec, f in((inspect.getfullargspec(f), f) for f in commands)];exit(0)
matching_commands = [f for f in commands if f.__name__ == args[0]]
if len(matching_commands)==0:print(f'Unknown command "{args[0]}"');sys.exit(1)
try: matching_commands[0](*args[1:])
except KeyboardInterrupt: pass
except subprocess.CalledProcessError as err: sys.exit(err.returncode)
