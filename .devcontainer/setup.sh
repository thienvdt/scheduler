#!/usr/bin/env bash
# Chạy một lần khi tạo Codespace: cài thư viện, tạo bảng trong D1 local, build bản tĩnh.
set -euo pipefail
npm ci
# Không có bàn phím để trả lời "Ok to proceed?" → tự đồng ý
yes | npx wrangler d1 migrations apply DB --local || true
npx wrangler d1 migrations list DB --local | grep -q "No migrations to apply" || { echo "Tạo bảng D1 thất bại"; exit 1; }
npm run build
