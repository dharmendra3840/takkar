"""Local preview server for www.playtakkar.in.

Run from the website folder:  python scripts/serve.py   (then open http://localhost:8787)

Unlike `python -m http.server`, it behaves like the site on Vercel (vercel.json, cleanUrls):
- /practice is practice.html even though a practice/ folder sits next to it, with or without
  a trailing slash; /hi is hi/index.html; folders are never listed; unknown paths get 404.html;
- /question-of-the-day, its dated pages and /sitemap-qotd.xml come from the same code as the
  Vercel function (lib/qotd-page.mjs, run with Node);
- every response has Cache-Control: no-store, so a refresh always shows your latest edits.
The waitlist form needs Vercel's function and Upstash; here it shows an error.
"""
import http.server
import json
import os
import re
import subprocess
import sys

PUBLIC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
QOTD = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lib', 'qotd-page.mjs')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787

# Runs the question-of-the-day code and prints {status, headers, body}.
QOTD_JS = """
import { pathToFileURL } from 'node:url';
const { qotdResponse, qotdSitemap } = await import(pathToFileURL(process.argv[1]).href);
const res = process.argv[2] === 'sitemap' ? qotdSitemap() : qotdResponse(process.argv[3] || '', Date.now(), process.argv[4] || 'en');
console.log(JSON.stringify({ status: res.status, headers: Object.fromEntries(res.headers), body: await res.text() }));
"""


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def send_head(self):
        path = self.path.split('?', 1)[0].split('#', 1)[0]
        qotd = re.fullmatch(r'/(hi/)?question-of-the-day(?:/([^/]+))?/?|/(sitemap)-qotd\.xml', path)
        if qotd:
            return self.qotd('sitemap' if qotd.group(3) else 'page', qotd.group(2) or '', 'hi' if qotd.group(1) else 'en')
        base = path.rstrip('/') or '/'
        local = self.translate_path(base)
        if base != '/' and os.path.isfile(local + '.html'):
            self.path = base + '.html'  # a page wins over a folder of the same name, as on Vercel
        elif os.path.isdir(local) and os.path.isfile(os.path.join(local, 'index.html')):
            self.path = base.rstrip('/') + '/index.html'
        elif not os.path.isfile(local):
            return self.not_found()
        return super().send_head()

    def qotd(self, kind, day, lang='en'):
        out = subprocess.run(['node', '--input-type=module', '-e', QOTD_JS, QOTD, kind, day, lang], capture_output=True, text=True, encoding='utf-8')
        if out.returncode != 0:
            self.send_error(500, out.stderr.strip()[-300:])
            return None
        res = json.loads(out.stdout)
        body = res['body'].encode('utf-8')
        self.send_response(res['status'])
        for name, value in res['headers'].items():
            if name.lower() != 'cache-control':
                self.send_header(name, value)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        return None

    def not_found(self):
        self.send_response(404)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        with open(os.path.join(PUBLIC, '404.html'), 'rb') as page:
            self.wfile.write(page.read())
        return None

    def log_message(self, format, *args):
        pass


class Server(http.server.ThreadingHTTPServer):
    # The app loads about 60 modules at once; Python's default backlog of 5 makes Windows refuse
    # some of them, and one missing module leaves the app on its splash screen.
    request_queue_size = 128
    daemon_threads = True


if __name__ == '__main__':
    with Server(('127.0.0.1', PORT), Handler) as server:
        print(f'Takkar preview on http://localhost:{PORT}  (Ctrl+C to stop)')
        server.serve_forever()
