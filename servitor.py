import json
import multiprocessing
import threading
import http.server
import signal
import logging

logging.basicConfig(
    format="%(asctime)s %(levelname)-8s %(message)s",
    level=logging.INFO,
    datefmt="%Y-%m-%d %H:%M:%S",
)


def wait_shutdown():
    mutex = threading.Lock()
    mutex.acquire()

    def shutdown_handler(sig, frame):
        mutex.release()

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)
    mutex.acquire()


class HTTPRequestHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.reply_json(200, {"message": "hello world"})

    def reply_json(self, code: int, body: object):
        self.reply(code, "application/json", json.dumps(body).encode())

    def reply(self, code: int, type: str, body: bytes):
        self.send_response(code)
        self.send_header("Content-Type", type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        logging.info(f"request address:{self.address_string()} {format % args}")


def start_web_server():
    httpd = http.server.HTTPServer(("", 8000), HTTPRequestHandler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()

    wait_shutdown()

    logging.info("shutting down http server")
    httpd.shutdown()
    thread.join()
    logging.info("http server shutted down")


def start():
    multiprocessing.set_start_method("spawn")
    processes = [multiprocessing.Process(target=start_web_server, daemon=True)]

    for process in processes:
        process.start()

    wait_shutdown()

    for process in processes:
        process.terminate()

    for process in processes:
        process.join()


if __name__ == "__main__":
    start()
