import json
import multiprocessing
import queue
import threading
import http.server
import signal
import logging

logging.basicConfig(
    format="%(asctime)s %(levelname)-8s PID:%(process)d %(message)s",
    level=logging.INFO,
    datefmt="%Y-%m-%d %H:%M:%S",
)


def handle_shutdown(handler):
    def shutdown_handler(sig, frame):
        logging.info(f"received {signal.Signals(sig).name}")
        handler()

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)


def http_request_handler(job_queue: multiprocessing.Queue):
    class HTTPRequestHandler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            job_queue.put("henlo")
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
            logging.debug(f"request address:{self.address_string()} {format % args}")

    return HTTPRequestHandler


def start_web_server(job_queue: multiprocessing.Queue):
    logging.info("starting web server")
    httpd = http.server.HTTPServer(("", 8000), http_request_handler(job_queue))
    thread = threading.Thread(target=httpd.serve_forever, args=(1,), daemon=True)
    thread.start()

    def shutdown_handler():
        logging.info("asking web server to shut down")
        httpd.shutdown()

    handle_shutdown(shutdown_handler)
    thread.join()
    logging.info("http server shutted down")


def start_job_worker(job_queue: multiprocessing.Queue):
    logging.info("starting job worker")
    keep_alive = True

    def shutdown_handler():
        logging.info("asking job worker to shut down")
        nonlocal keep_alive
        keep_alive = False

    handle_shutdown(shutdown_handler)
    while keep_alive:
        try:
            data = job_queue.get(timeout=1)
            logging.info("received data: " + data)
        except queue.Empty:
            pass

    logging.info("job worker shutted down")


def start():
    logging.info("starting")
    multiprocessing.set_start_method("spawn")

    job_queue = multiprocessing.Queue()

    processes = [
        multiprocessing.Process(target=start_web_server, args=(job_queue,), daemon=True)
    ]
    for _ in range(max(multiprocessing.cpu_count(), 2)):
        processes.append(
            multiprocessing.Process(
                target=start_job_worker, args=(job_queue,), daemon=True
            )
        )

    for process in processes:
        process.start()

    def shutdown_handler():
        logging.info("shutting down everything")
        for process in processes:
            process.terminate()

    handle_shutdown(shutdown_handler)

    for process in processes:
        process.join()

    logging.info("shutting down")


if __name__ == "__main__":
    start()
