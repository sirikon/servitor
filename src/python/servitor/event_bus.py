import threading
import multiprocessing
import multiprocessing.connection
from typing import Callable

from servitor.framework.logging import log


class EventBusClient:
    _handlers: list[Callable]
    _handlers_lock: threading.Lock
    _connection: multiprocessing.connection.Connection

    def __init__(
        self,
        connection: multiprocessing.connection.Connection,
    ) -> None:
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
    _connections: list[
        tuple[
            multiprocessing.connection.Connection,
            multiprocessing.connection.Connection,
        ]
    ]

    def __init__(self) -> None:
        self._connections = []

    def spawn_client(self):
        client_conn, root_conn = multiprocessing.Pipe()

        # Storing the client connection, even though we're not going to use
        # it, prevents the connection from being closed when the associated
        # the process that receives it shuts down.
        #
        # This is the alternative to a way more complicated de-registration
        # mechanism.
        self._connections.append((client_conn, root_conn))

        threading.Thread(target=self._broadcast, args=(root_conn,), daemon=True).start()
        return EventBusClient(client_conn)

    def _broadcast(self, connection):
        try:
            while True:
                msg = connection.recv()
                for _, c in self._connections:
                    if c is not connection:
                        c.send(msg)
        except EOFError:
            log.info("event bus broadcaster closed")


_event_bus_client: EventBusClient | None = None


def set_event_bus_client(event_bus_client: EventBusClient):
    global _event_bus_client
    _event_bus_client = event_bus_client


def get_event_bus_client() -> EventBusClient:
    return _event_bus_client
