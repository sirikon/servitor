#!/usr/bin/env python3

DENO_ENTRY = 'src/main.ts'
DENO_EXEC_FLAGS = ['-A', '--unstable']
DENO_CONFIG = ['--config', 'src/deno.json']
DENO_IMPORT_MAP = ['--import-map', 'src/import_map.json']
DENO_LOCK = ['--lock', 'src/lock.json']


def cli():

    @command
    def run(*args):
        cmd('deno', 'run',
            *DENO_EXEC_FLAGS,
            *DENO_CONFIG,
            *DENO_IMPORT_MAP,
            *DENO_LOCK,
            DENO_ENTRY, *args)

    @command
    def cache():
        cmd('deno', 'cache',
            *DENO_CONFIG,
            *DENO_IMPORT_MAP,
            *DENO_LOCK,
            DENO_ENTRY)

    @command
    def lock():
        cmd('deno', 'cache',
            *DENO_CONFIG,
            *DENO_IMPORT_MAP,
            *DENO_LOCK,
            '--lock-write',
            DENO_ENTRY)

    @command
    def fmt():
        cmd('deno', 'fmt', *DENO_CONFIG, 'src')

    @command
    def lint():
        cmd('deno', 'lint', *DENO_CONFIG, 'src')





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
