#!/usr/bin/env node
// Máy chủ thử chức năng Nhập thời khoá biểu ở máy local (không dùng khi deploy).
//   npm run demo:import            → http://127.0.0.1:8790  (app GVBM giả lập, KHÁC tên miền với app lịch)
// App lịch chạy ở http://localhost:8788 (npm run preview). "localhost" và "127.0.0.1" là hai tên miền khác nhau
// với trình duyệt, nên đây đúng là trường hợp app GVCN/GVBM ở trang web khác.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "../../demo");
const port = Number(process.env.PORT ?? 8790);
const files = { "/": "gvbm-app.html", "/tkb-mau.csv": "tkb-mau.csv", "/tkb-mau.json": "tkb-mau.json" };
const types = { ".html": "text/html; charset=utf-8", ".csv": "text/csv; charset=utf-8", ".json": "application/json; charset=utf-8" };

createServer(async (req, res) => {
  const name = files[new URL(req.url, "http://x").pathname];
  if (!name) return res.writeHead(404).end("Không có");
  res.writeHead(200, { "content-type": types[extname(name)], "cache-control": "no-store" });
  res.end(await readFile(join(root, name)));
}).listen(port, "127.0.0.1", () => {
  console.log(`App GVBM giả lập: http://127.0.0.1:${port}`);
  console.log(`File mẫu:         http://127.0.0.1:${port}/tkb-mau.csv  ·  /tkb-mau.json (hoặc trong thư mục demo/)`);
  console.log("App lịch:         http://localhost:8788  (chạy npm run preview ở terminal khác)");
});
