import EventEmitter from "eventemitter3";

export type EventBus = EventEmitter<EventTypes>;

export type EventTypes = {
  "seed-execution-created": (args: { id: number }) => void;
  "seed-execution-started": (args: { id: number }) => void;
  "seed-execution-ended": (args: { id: number }) => void;
  "shutdown": () => void;
};

export const eventBus = new EventEmitter<EventTypes>();
