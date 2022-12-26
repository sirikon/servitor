import EventEmitter from "eventemitter3";

export type EventBus = EventEmitter<EventTypes>;

export type EventTypes = {
  "shutdown": () => void;
};

export const eventBus = new EventEmitter<EventTypes>();
