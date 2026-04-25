# /// script
# dependencies = [
#     "flask",
# ]
# requires-python = ">=3.10"
# ///
import os
import sys
from pathlib import Path

# 1. 強制設定路徑與 TMP 隔離 (核心原則)
BASE_DIR = Path(__file__).parent.resolve()
TMP_DIR = BASE_DIR / "TMP"
TMP_DIR.mkdir(parents=True, exist_ok=True)

# 2. 快取隔離：第三方套件與 Python 快取雙重鎖定
os.environ["PYTHONPYCACHEPREFIX"] = str(TMP_DIR / "pycache")
os.environ["XDG_CACHE_HOME"] = str(TMP_DIR / "cache")

# 影子驗證：啟動時驗證全數指向 TMP/ 否則 fail fast
def validate_sandbox():
    cache_prefix = os.getenv("PYTHONPYCACHEPREFIX")
    if not cache_prefix or not cache_prefix.startswith(str(BASE_DIR)):
        print("CRITICAL: Sandbox violation! PYTHONPYCACHEPREFIX must be inside ./TMP/")
        sys.exit(1)

validate_sandbox()

import logging
from flask import Flask, send_from_directory

# 停用 Flask 預設的開發伺服器警告
import flask.cli
flask.cli.show_server_banner = lambda *args: None

app = Flask(__name__)

# 停用 Werkzeug 日誌以減少雜訊，僅保留錯誤
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

@app.route('/')
def index():
    return send_from_directory(str(BASE_DIR), 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(str(BASE_DIR), path)

if __name__ == "__main__":
    print(f"--- Environment Verified ---")
    print(f"Base: {BASE_DIR}")
    print(f"Tmp:  {TMP_DIR}")
    print(f"--- Starting Server ---")
    print(f"Local Access: http://127.0.0.1:8080")
    
    # 使用 0.0.0.0 確保容器或遠端可存取，禁止 reloader 以維持環境純粹
    app.run(host='0.0.0.0', port=8080, debug=True, use_reloader=False)
