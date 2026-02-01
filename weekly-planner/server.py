#!/usr/bin/env python3
"""
Simple server that serves the app AND allows reading/writing JSON data files.
Run with: python3 server.py
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
import json
import os
import threading

PORT = 8080
DATA_DIR = 'data'

# Lock for file writes to prevent race conditions
file_lock = threading.Lock()

class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    """Handle requests in separate threads."""
    daemon_threads = True

class DataHandler(SimpleHTTPRequestHandler):
    
    def do_GET(self):
        # Serve data files as JSON
        if self.path.startswith('/api/'):
            self.handle_api_get()
        else:
            super().do_GET()
    
    def do_POST(self):
        # Save data to JSON files
        if self.path.startswith('/api/'):
            self.handle_api_post()
        else:
            self.send_error(404)
    
    def handle_api_get(self):
        filename = self.path.replace('/api/', '') + '.json'
        filepath = os.path.join(DATA_DIR, filename)
        
        if os.path.exists(filepath):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            with open(filepath, 'r') as f:
                self.wfile.write(f.read().encode())
        else:
            self.send_error(404, f'File not found: {filename}')
    
    def handle_api_post(self):
        filename = self.path.replace('/api/', '') + '.json'
        filepath = os.path.join(DATA_DIR, filename)
        
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            # Validate JSON
            data = json.loads(post_data)
            
            # Write to file with lock to prevent race conditions
            with file_lock:
                with open(filepath, 'w') as f:
                    json.dump(data, f, indent=2)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True}).encode())
            print(f'Saved {filename}')
            
        except json.JSONDecodeError as e:
            self.send_error(400, f'Invalid JSON: {e}')
        except Exception as e:
            self.send_error(500, f'Error saving: {e}')
    
    def do_OPTIONS(self):
        # Handle CORS preflight
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)) or '.')
    
    print(f'Starting server at http://localhost:{PORT}')
    print(f'Data files in: {os.path.abspath(DATA_DIR)}/')
    print('Press Ctrl+C to stop\n')
    
    httpd = ThreadingHTTPServer(('', PORT), DataHandler)
    httpd.serve_forever()
