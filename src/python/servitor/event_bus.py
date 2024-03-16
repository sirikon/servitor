import threading
import multiprocessing
import multiprocessing.connection
from typing import Callable

from servitor.framework.logging import log


class EventBusClient:
    _handlers: list[Callable]
    _handlers_lock: threading.Lock
    _connection: multiprocessing.connection.Connection

    def __init__(self, connection: multiprocessing.connection.Connection) -> None:
        self._handlers = []
        self._handlers_lock = None
        self._connection = connection

    def start(self):
        self._handlers_lock = threading.Lock()
        threading.Thread(target=self._repeater, daemon=True).start()

    def listen(self, handler):
        with self._handlers_lock:
            if handler not in self._handlers:
                self._handlers.append(handler)

    def unlisten(self, handler):
        with self._handlers_lock:
            if handler in self._handlers:
                self._handlers.remove(handler)

    def _repeater(self):
        try:
            while True:
                msg = self._connection.recv()
                self._handle(msg)
        except EOFError:
            log.info("event bus client repeater closed")

    def _handle(self, msg):
        with self._handlers_lock:
            for handler in self._handlers:
                handler(msg)

    def send(self, id, payload=None):
        msg = {"id": id, "payload": payload}
        self._handle(msg)
        self._connection.send(msg)


class EventBus:
    _connections: list[multiprocessing.connection.Connection]

    def __init__(self) -> None:
        self._connections = []

    def spawn_client(self):
        client_conn, root_conn = multiprocessing.Pipe()
        self._connections.append(root_conn)
        return EventBusClient(client_conn)

    def start(self):
        for connection in self._connections:
            threading.Thread(
                target=self._broadcast, args=(connection,), daemon=True
            ).start()

    def _broadcast(self, connection):
        try:
            while True:
                msg = connection.recv()
                for c in self._connections:
                    if c is not connection:
                        try:
                            c.send(msg)
                        except BrokenPipeError:
                            log.error("broken pipe error")
        except EOFError:
            log.info("event bus broadcaster closed")


_event_bus_client: EventBusClient | None = None


def set_event_bus_client(event_bus_client: EventBusClient):
    global _event_bus_client
    _event_bus_client = event_bus_client


def get_event_bus_client() -> EventBusClient:
    return _event_bus_client
