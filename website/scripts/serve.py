"""Local preview server for takkar.info.

Run from the website folder:  python scripts/serve.py   (then open http://localhost:8787)

Unlike `python -m http.server`, it:
- sends Cache-Control: no-store, so every refresh shows your latest edits;
- serves /privacy from privacy.html and unknown paths with 404.html, like Cloudflare Pages.
The early-access form needs `npx wrangler@4 pages dev` (it uses D1); here it shows an error.
"""
import http.server
import os
import sys

PUBLIC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def send_head(self):
        path = self.path.split('?', 1)[0].split('#', 1)[0]
        local = self.translate_path(path)
        if not os.path.exists(local) and os.path.exists(local + '.html'):
            self.path = path + '.html'
        elif not os.path.exists(local):
            self.send_response(404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            with open(os.path.join(PUBLIC, '404.html'), 'rb') as page:
                self.wfile.write(page.read())
            return None
        return super().send_head()

    def log_message(self, format, *args):
        pass


if __name__ == '__main__':
    with http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler) as server:
        print(f'Takkar preview on http://localhost:{PORT}  (Ctrl+C to stop)')
        server.serve_forever()
