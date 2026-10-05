// Tạo mã băm mật khẩu giống server (PBKDF2-SHA256, 100.000 vòng) – dùng để đặt lại mật khẩu quản trị khi bị quên:
//   node scripts/hash-password.mjs 'MatKhauMoi123'
//   npx wrangler d1 execute scheduler-db --remote --command "UPDATE users SET password_hash='<kết quả>' WHERE username='admin'"
import { webcrypto as crypto } from "node:crypto";

const password = process.argv[2];
if (!password || password.length < 8) {
  console.error("Cách dùng: node scripts/hash-password.mjs <mật khẩu, tối thiểu 8 ký tự>");
  process.exit(1);
}
const iterations = 100_000;
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
const b64 = (b) => Buffer.from(b).toString("base64");
console.log(`pbkdf2$${iterations}$${b64(salt)}$${b64(bits)}`);
