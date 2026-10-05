#!/usr/bin/env node
// Cài đặt app lên tài khoản Cloudflare CỦA CHÍNH ĐƠN VỊ (gói miễn phí; vượt hạn mức thì đơn vị tự trả Cloudflare).
// Chạy: npm run setup:cloudflare
//   Tuỳ chọn: -- --name=lich-truong-abc --location=apac   (không hỏi lại)
//             -- --dry-run                                (chỉ in các lệnh sẽ chạy)
//             -- --simulate [--port=8790]                 (mô phỏng: chạy thật mọi bước trên Cloudflare giả lập
//                                                          trong máy – không cần tài khoản, không đụng wrangler.toml)
//
// Các bước: đăng nhập Cloudflare → tạo cơ sở dữ liệu D1 → ghi database_id vào wrangler.toml
//           → tạo bảng (migrations) → build → tạo dự án Pages → deploy.

import { execFileSync, spawn, spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const DRY = process.argv.includes("--dry-run");
const SIM = process.argv.includes("--simulate");
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const TOML = new URL("../wrangler.toml", import.meta.url);
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,56}[a-z0-9]$/;

const c = { dim: "\x1b[2m", bold: "\x1b[1m", green: "\x1b[32m", red: "\x1b[31m", cyan: "\x1b[36m", reset: "\x1b[0m" };
const step = (n, text) => console.log(`\n${c.cyan}${c.bold}[${n}/6]${c.reset} ${c.bold}${text}${c.reset}`);

/** Chạy wrangler, trả về stdout; inherit = hiện trực tiếp cho người dùng (vd. đăng nhập qua trình duyệt). */
function wrangler(args, { inherit = false, allowFail = false } = {}) {
  console.log(`${c.dim}$ npx wrangler ${args.join(" ")}${c.reset}`);
  if (DRY) return "";
  if (inherit) {
    const r = spawnSync("npx", ["wrangler", ...args], { stdio: "inherit" });
    if (r.status !== 0 && !allowFail) throw new Error(`wrangler ${args[0]} thất bại`);
    return "";
  }
  try {
    return execFileSync("npx", ["wrangler", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    if (allowFail) return `${err.stdout ?? ""}${err.stderr ?? ""}`;
    process.stderr.write(err.stdout ?? "");
    process.stderr.write(err.stderr ?? "");
    throw new Error(`wrangler ${args.join(" ")} thất bại`);
  }
}

function run(cmd, args) {
  console.log(`${c.dim}$ ${cmd} ${args.join(" ")}${c.reset}`);
  if (DRY) return;
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} thất bại`);
}

async function main() {
  const mode = DRY ? "  [chạy thử – không thay đổi gì]" : SIM ? "  [mô phỏng – Cloudflare giả lập trong máy]" : "";
  console.log(`${c.bold}Cài đặt Lịch lên Cloudflare (tài khoản của đơn vị bạn)${c.reset}${mode}`);
  console.log(`${c.dim}Gói miễn phí của Cloudflare đủ cho hầu hết trường học / doanh nghiệp vừa và nhỏ.${c.reset}`);

  let rl = null;
  const ask = async (q, def, given) => {
    if (given) return given;
    rl ??= createInterface({ input: process.stdin, output: process.stdout });
    return (await rl.question(`${q} ${c.dim}(${def})${c.reset}: `)).trim() || def;
  };

  step(1, "Đăng nhập Cloudflare");
  if (SIM) return simulate(ask);
  const who = wrangler(["whoami"], { allowFail: true });
  if (DRY || /not authenticated|You are not logged in/i.test(who)) {
    console.log("Trình duyệt sẽ mở để bạn đăng nhập (hoặc tạo tài khoản miễn phí tại dash.cloudflare.com/sign-up).");
    wrangler(["login"], { inherit: true });
  } else {
    console.log(`${c.green}✓ Đã đăng nhập${c.reset}`);
  }

  step(2, "Đặt tên");
  let project;
  for (;;) {
    project = (await ask("Tên dự án (chữ thường, số, dấu -; sẽ thành <tên>.pages.dev)", "lich-don-vi", arg("name"))).toLowerCase();
    if (NAME_RE.test(project)) break;
    console.log(`${c.red}Tên không hợp lệ.${c.reset}`);
    if (arg("name")) throw new Error("--name không hợp lệ");
  }
  const dbName = `${project}-db`;
  const location = await ask("Vị trí lưu dữ liệu: apac (châu Á – nên chọn ở Việt Nam), weur, enam…", "apac", arg("location"));
  rl?.close();
  console.log(`Dự án: ${c.bold}${project}${c.reset} · Cơ sở dữ liệu: ${c.bold}${dbName}${c.reset} · Vị trí: ${location}`);

  step(3, `Tạo cơ sở dữ liệu D1 “${dbName}”`);
  let dbId = "";
  const created = wrangler(["d1", "create", dbName, "--location", location], { allowFail: true });
  dbId = created.match(/database_id\W+([0-9a-f-]{36})/i)?.[1] ?? "";
  if (!dbId && !DRY) {
    // Đã tồn tại → lấy id từ danh sách
    const list = JSON.parse(wrangler(["d1", "list", "--json"]) || "[]");
    dbId = list.find((d) => d.name === dbName)?.uuid ?? "";
  }
  if (!dbId && !DRY) throw new Error(`Không tạo/tìm được D1 "${dbName}". Kết quả:\n${created}`);
  console.log(DRY ? `${c.dim}(chạy thử) database_id sẽ lấy từ kết quả lệnh trên${c.reset}` : `${c.green}✓ database_id = ${dbId}${c.reset}`);

  // Ghi vào wrangler.toml
  const toml = readFileSync(TOML, "utf8")
    .replace(/^name = ".*"$/m, `name = "${project}"`)
    .replace(/^database_name = ".*"$/m, `database_name = "${dbName}"`)
    .replace(/^database_id = ".*"$/m, `database_id = "${dbId || "<id>"}"`);
  if (!DRY) writeFileSync(TOML, toml);
  console.log(DRY ? `${c.dim}(chạy thử) sẽ ghi name, database_name, database_id vào wrangler.toml${c.reset}` : `${c.green}✓ Đã cập nhật wrangler.toml${c.reset}`);

  step(4, "Tạo bảng dữ liệu");
  wrangler(["d1", "migrations", "apply", "DB", "--remote"], { inherit: true });

  step(5, "Build giao diện");
  run("npm", ["run", "build"]);

  step(6, "Tạo dự án Pages và deploy");
  wrangler(["pages", "project", "create", project, "--production-branch", "main"], { allowFail: true });
  const out = wrangler(["pages", "deploy", "out", "--project-name", project, "--branch", "main", "--commit-dirty=true"]);
  if (!DRY) process.stdout.write(out);

  const url = `https://${project}.pages.dev`;
  console.log(`\n${c.green}${c.bold}Xong!${c.reset} Mở ${c.bold}${url}${c.reset} ngay để tạo tài khoản quản trị viên đầu tiên.`);
  console.log(`${c.dim}(Có thể mất 1–2 phút để tên miền hoạt động. Lần cập nhật sau chỉ cần: npm run deploy)${c.reset}`);
}

/** Mô phỏng: chạy thật các bước trên Cloudflare giả lập (wrangler --local), dữ liệu riêng trong .wrangler/simulate. */
async function simulate(ask) {
  const sim = (text) => console.log(`${c.dim}(mô phỏng) ${text}${c.reset}`);
  sim("bỏ qua đăng nhập – không cần tài khoản Cloudflare");

  step(2, "Đặt tên");
  const project = (await ask("Tên dự án", "lich-don-vi", arg("name"))).toLowerCase();
  if (!NAME_RE.test(project)) throw new Error("Tên dự án không hợp lệ");
  const location = arg("location") ?? "apac";
  const port = arg("port") ?? "8790";
  const dir = `.wrangler/simulate/${project}`;
  console.log(`Dự án: ${c.bold}${project}${c.reset} · Cơ sở dữ liệu: ${c.bold}${project}-db${c.reset} · Vị trí: ${location}`);

  step(3, `Tạo cơ sở dữ liệu D1 “${project}-db”`);
  rmSync(dir, { recursive: true, force: true });
  sim(`tạo D1 cục bộ tại ${dir} (thay cho: wrangler d1 create ${project}-db --location ${location})`);
  sim(`trên Cloudflare thật, database_id sẽ được ghi vào wrangler.toml – bản mô phỏng không sửa file này`);
  console.log(`${c.green}✓ Đã tạo cơ sở dữ liệu giả lập${c.reset}`);

  step(4, "Tạo bảng dữ liệu");
  const migrated = wrangler(["d1", "migrations", "apply", "DB", "--local", "--persist-to", dir]);
  // wrangler in bảng tiến trình nhiều lần → bỏ trùng
  const applied = [...new Set([...migrated.matchAll(/(\d{4}_\w+\.sql)\s*│\s*✅/g)].map((m) => m[1]))];
  console.log(`${c.green}✓ Đã chạy ${applied.length} migration: ${applied.join(", ")}${c.reset}`);

  step(5, "Build giao diện");
  run("npm", ["run", "build", "--silent"]);
  console.log(`${c.green}✓ Đã build vào thư mục out/${c.reset}`);

  step(6, "Deploy (mô phỏng)");
  sim(`thay cho: wrangler pages deploy out --project-name ${project}`);
  const args = ["wrangler", "pages", "dev", "out", "--port", port, "--persist-to", dir, "--inspector-port", String(Number(port) + 1000)];
  console.log(`${c.dim}$ npx ${args.join(" ")}${c.reset}`);
  const server = spawn("npx", args, { stdio: ["ignore", "pipe", "pipe"] });
  const url = `http://localhost:${port}`;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await fetch(`${url}/api/health`).then((r) => r.ok, () => false)) break;
  }
  console.log(`\n${c.green}${c.bold}Xong (mô phỏng)!${c.reset} Mở ${c.bold}${url}${c.reset} để chọn loại hình và tạo tài khoản quản trị.`);
  console.log(`${c.dim}Trên Cloudflare thật địa chỉ sẽ là https://${project}.pages.dev. Nhấn Ctrl+C để dừng mô phỏng.${c.reset}`);
  const stop = () => {
    server.kill();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  await new Promise((resolve) => server.on("exit", resolve));
}

main().catch((err) => {
  console.error(`\n${c.red}✗ ${err.message}${c.reset}`);
  process.exit(1);
});
