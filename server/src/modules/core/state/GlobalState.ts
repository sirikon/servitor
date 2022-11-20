import EventEmitter from "eventemitter3";

export type EventTypes = {
  "seed-execution-started": (args: { id: number }) => void;
  "seed-execution-ended": (args: { id: number }) => void;
};

export class GlobalState {
  private runningSeedExecutions: Set<number> = new Set();

  constructor(
    public eventEmitter: EventEmitter<EventTypes>,
  ) {}

  public setSeedExecutionRunningState(
    opts: { id: number; running: boolean },
  ) {
    opts.running
      ? this.runningSeedExecutions.add(opts.id)
      : this.runningSeedExecutions.delete(opts.id);
    this.eventEmitter.emit(
      opts.running ? "seed-execution-started" : "seed-execution-ended",
      {
        id: opts.id,
      },
    );
  }

  public isSeedExecutionRunning(opts: { id: number }) {
    return this.runningSeedExecutions.has(opts.id);
  }
}

export const globalState = new GlobalState(new EventEmitter());
