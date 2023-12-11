import json
import multiprocessing
import http.server
import signal
import sys


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
    httpd.serve_forever()


def spawn_web_server_process():
    p = multiprocessing.Process(target=start_web_server, daemon=True)
    p.start()
    return p


if __name__ == "__main__":
    multiprocessing.set_start_method("spawn")
    web_server_process = spawn_web_server_process()

    def signal_handler(sig, frame):
        print("You pressed Ctrl+C!")
        web_server_process.terminate()
        web_server_process.join()
        web_server_process.close()

    signal.signal(signal.SIGINT, signal_handler)
    signal.pause()
