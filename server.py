#!/usr/bin/env python3
"""Minimal dev server for the Gas Line Quoter (no Node.js required)."""
import http.server
import socketserver
import os

PORT = 5173
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Serve the CDN-based entry point at the root
        if self.path in ('/', '/index.html'):
            self.path = '/index-cdn.html'
        return super().do_GET()

    def log_message(self, fmt, *args):
        pass  # suppress per-request logs


with socketserver.TCPServer(('', PORT), Handler) as httpd:
    httpd.allow_reuse_address = True
    print(f'http://localhost:{PORT}', flush=True)
    httpd.serve_forever()
