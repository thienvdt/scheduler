#!/usr/bin/env node
// Phục vụ bản build tĩnh (out/) – đủ để chạy app vì dữ liệu nằm trong trình duyệt.
//   npm run preview   (build rồi chạy)   ·   npm start   (chạy bản đã build)
// PORT=8788 mặc định. Có thể thay bằng bất kỳ máy chủ file tĩnh nào (nginx, GitHub Pages, Netlify…).

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "../../out");
const port = Number(process.env.PORT ?? 8788);
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

async function resolve(pathname) {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  for (const candidate of [safe, join(safe, "index.html"), `${safe}.html`]) {
    const file = join(root, candidate);
    if (!file.startsWith(root)) return null;
    try {
      if ((await stat(file)).isFile()) return file;
    } catch {}
  }
  return null;
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://x");
  const file = (await resolve(pathname)) ?? join(root, "404.html");
  try {
    const body = await readFile(file);
    res.writeHead(file.endsWith("404.html") && !pathname.endsWith("404.html") ? 404 : 200, {
      "content-type": types[extname(file)] ?? "application/octet-stream",
      "cache-control": pathname.startsWith("/_next/static/") ? "public, max-age=31536000, immutable" : "no-cache",
    });
    res.end(body);
  } catch {
    res.writeHead(500).end("Chưa có bản build – hãy chạy: npm run build");
  }
})
  .on("error", (err) => {
    if (err.code !== "EADDRINUSE") throw err;
    console.error(`Cổng ${port} đang được dùng (có thể app đã chạy ở cửa sổ khác). Tắt cửa sổ đó, hoặc chạy: PORT=8789 npm start`);
    process.exit(1);
  })
  .listen(port, () => console.log(`App Lịch: http://localhost:${port}  (dữ liệu lưu trong trình duyệt – Ctrl+C để dừng)`));
