#!/usr/bin/env python3
"""Minimal dev server for the Gas Line Quoter (no Node.js required)."""
import http.server
import socketserver
import os

PORT = int(os.environ.get('PORT', 5174))
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Serve the CDN-based entry point at the root
        if self.path in ('/', '/index.html'):
            self.path = '/index-cdn.html'
        return super().do_GET()

    def end_headers(self):
        # Never cache during dev — always serve the latest source
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        return super().end_headers()

    def log_message(self, fmt, *args):
        pass  # suppress per-request logs


with socketserver.TCPServer(('', PORT), Handler) as httpd:
    httpd.allow_reuse_address = True
    print(f'http://localhost:{PORT}', flush=True)
    httpd.serve_forever()
