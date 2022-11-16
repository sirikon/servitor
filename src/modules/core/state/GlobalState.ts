import EventEmitter from "eventemitter3";

export type EventTypes = {
  "seed-execution-started": (args: { execution: number }) => void;
  "seed-execution-ended": (args: { execution: number }) => void;
};

export class GlobalState {
  private runningSeedExecutions: Set<number> = new Set();

  constructor(
    public eventEmitter: EventEmitter<EventTypes>,
  ) {}

  public setSeedExecutionRunningState(
    opts: { execution: number; running: boolean },
  ) {
    opts.running
      ? this.runningSeedExecutions.add(opts.execution)
      : this.runningSeedExecutions.delete(opts.execution);
    this.eventEmitter.emit(
      opts.running ? "seed-execution-started" : "seed-execution-ended",
      {
        execution: opts.execution,
      },
    );
  }

  public isSeedExecutionRunning(opts: { execution: number }) {
    return this.runningSeedExecutions.has(opts.execution);
  }
}

export const globalState = new GlobalState(new EventEmitter());
