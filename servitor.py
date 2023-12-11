import json
from http.server import HTTPServer, BaseHTTPRequestHandler


class ServitorWebServer(BaseHTTPRequestHandler):
    def do_GET(self):
        self.reply_json(200, {"message": "hello world"})

    def reply(self, code: int, type: str, body: bytes):
        self.send_response(code)
        self.send_header("Content-Type", type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def reply_json(self, code: int, body: object):
        self.reply(code, "application/json", json.dumps(body).encode())


httpd = HTTPServer(("", 8000), ServitorWebServer)
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    httpd.shutdown()
