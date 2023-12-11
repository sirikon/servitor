import json
import multiprocessing
import threading
import http.server
import signal
import logging


class ServitorWebServer(http.server.BaseHTTPRequestHandler):
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


def start_web_server():
    httpd = http.server.HTTPServer(("", 8000), ServitorWebServer)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()

    def shutdown_handler(sig, frame):
        print("Sigterm received!")
        httpd.shutdown()
        print("Shutdown sent")

    handle_shutdown(shutdown_handler)
    thread.join()


def handle_shutdown(handler):
    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)


if __name__ == "__main__":
    ctx = multiprocessing.get_context("spawn")
    processes = [ctx.Process(target=start_web_server, daemon=True)]

    for process in processes:
        process.start()

    def shutdown_handler(sig, frame):
        for process in processes:
            process.terminate()

    handle_shutdown(shutdown_handler)

    for process in processes:
        process.join()
