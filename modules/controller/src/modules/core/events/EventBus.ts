import EventEmitter from "eventemitter3";
import { container } from "tsyringe";

export type EventTypes = {
  "shutdown": () => void;
};
export class EventBus extends EventEmitter<EventTypes> {}

container.register<EventBus>(EventBus, { useValue: new EventBus() });
