// Nơi lưu dữ liệu, chọn lúc build:
//  - "local" (mặc định): mọi dữ liệu nằm trong localStorage của trình duyệt, không cần máy chủ.
//  - "cloudflare": dữ liệu dùng chung trên Cloudflare D1 (NEXT_PUBLIC_STORAGE=cloudflare, xem npm run setup:cloudflare).
export type StorageMode = "local" | "cloudflare";
export const STORAGE_MODE: StorageMode = process.env.NEXT_PUBLIC_STORAGE === "cloudflare" ? "cloudflare" : "local";
export const IS_LOCAL = STORAGE_MODE === "local";
