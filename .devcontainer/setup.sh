#!/usr/bin/env bash
# Chạy một lần khi tạo Codespace: cài thư viện rồi build bản tĩnh (dữ liệu lưu trong trình duyệt, không cần CSDL).
set -euo pipefail
npm ci
npm run build
