#!/usr/bin/env node
// Chuẩn bị chế độ lưu trên trình duyệt (chạy tự động trước dev/build):
//  1. Gom các file migrations/*.sql thành src/lib/local/migrations.generated.ts để trình duyệt tự tạo bảng.
//  2. Chép sql-wasm.wasm (SQLite biên dịch sang WebAssembly) vào public/.

import { copyFileSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "../..");
const dir = join(root, "migrations");
const migrations = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((name) => ({ name, sql: readFileSync(join(dir, name), "utf8") }));

const out = `// TỰ SINH bởi scripts/prepare-local.mjs từ thư mục migrations/ – đừng sửa tay.
export const MIGRATIONS: { name: string; sql: string }[] = ${JSON.stringify(migrations, null, 2)};
`;
const target = join(root, "src/lib/local/migrations.generated.ts");
let current = "";
try {
  current = readFileSync(target, "utf8");
} catch {}
if (current !== out) writeFileSync(target, out);

copyFileSync(join(root, "node_modules/sql.js/dist/sql-wasm.wasm"), join(root, "public/sql-wasm.wasm"));
console.log(`✓ ${migrations.length} migrations · public/sql-wasm.wasm`);
