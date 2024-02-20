import threading
import multiprocessing
import multiprocessing.connection

from servitor.framework.logging import log


class EventBusClient:
    _connection: multiprocessing.connection.Connection

    def __init__(self, connection: multiprocessing.connection.Connection) -> None:
        self._connection = connection

    def listen(self, handler):
        threading.Thread(target=self._listen, args=(handler,), daemon=True).start()

    def _listen(self, handler):
        try:
            while True:
                msg = self._connection.recv()
                handler(msg)
        except EOFError:
            log.info("event bus client closed")

    def send(self, msg):
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
