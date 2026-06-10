"""
本地开发服务器
- 提供静态文件服务
- 运行时自动替换 gallery.js 中的 CDN URL 为本地路径
- 默认端口 8000
"""
import http.server
import socketserver
import os
import re
import webbrowser

PORT = 8000
ROOT = os.path.dirname(os.path.abspath(__file__))
CDN_PATTERN = (r"https://gh-proxy.org/https:/raw.githubusercontent.com/DawnNights/seer_gallery/refs/heads/main/").encode()
LOCAL_REPLACEMENT = f"http://localhost:{PORT}".encode()

MIME_MAP = {
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
}


class LocalDevHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_GET(self):
        path = self.translate_path(self.path)

        # 目录请求 → 找 index.html
        if os.path.isdir(path):
            path = os.path.join(path, "index.html")

        if not os.path.exists(path) or not os.path.isfile(path):
            self.send_error(404)
            return

        ext = os.path.splitext(path)[1].lower()
        mime = MIME_MAP.get(ext, "application/octet-stream")

        # 先读取内容
        with open(path, "rb") as f:
            content = f.read()

        # 对 gallery.js 替换 CDN 路径为本地路径
        if ext == ".js":
            content = re.sub(CDN_PATTERN, LOCAL_REPLACEMENT, content)

        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def log_message(self, format, *args):
        if len(args) >= 2:
            status = args[1]
            icon = "  ok" if str(status) == "200" else f" {status}"
            print(f"  {args[0]}  {icon}", flush=True)


def main():
    os.chdir(ROOT)
    print(f"\n  本地开发服务器启动")
    print(f"  ─────────────────────────")
    print(f"  地址: http://localhost:{PORT}")
    print(f"  目录: {ROOT}")
    print(f"  gallery.js 中的 CDN URL 已替换为本地路径")
    print(f"  按 Ctrl+C 停止\n")

    webbrowser.open(f"http://localhost:{PORT}")

    with socketserver.TCPServer(("127.0.0.1", PORT), LocalDevHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  服务器已停止")
            httpd.shutdown()


if __name__ == "__main__":
    main()
