import threading
import multiprocessing
import multiprocessing.connection

from servitor.framework.logging import log


class EventBusClient:
    _handlers = []
    _handlers_lock = threading.Lock()
    _connection: multiprocessing.connection.Connection = None

    def __init__(self, connection: multiprocessing.connection.Connection) -> None:
        self._connection = connection

    def start(self):
        threading.Thread(target=self._repeater, daemon=True).start()

    def listen(self, handler):
        self._handlers_lock.acquire()
        try:
            if handler not in self._handlers:
                self._handlers.append(handler)
        finally:
            self._handlers_lock.release()

    def unlisten(self, handler):
        self._handlers_lock.acquire()
        try:
            if handler in self._handlers:
                self._handlers.remove(handler)
        finally:
            self._handlers_lock.release()

    def _repeater(self):
        try:
            while True:
                msg = self._connection.recv()
                self._handle(msg)
        except EOFError:
            log.info("event bus client repeater closed")

    def _handle(self, msg):
        self._handlers_lock.acquire()
        try:
            for handler in self._handlers:
                handler(msg)
        finally:
            self._handlers_lock.release()

    def send(self, id, payload=None):
        msg = {"id": id, "payload": payload}
        self._handle(msg)
        self._connection.send(msg)


class EventBus:
    _connections: list[multiprocessing.connection.Connection] = []

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
                        c.send(msg)
        except EOFError:
            log.info("event bus broadcaster closed")


_event_bus_client: EventBusClient | None = None


def set_event_bus_client(event_bus_client: EventBusClient):
    global _event_bus_client
    _event_bus_client = event_bus_client


def get_event_bus_client() -> EventBusClient:
    return _event_bus_client
