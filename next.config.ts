import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const isCloudflare = process.env.NEXT_PUBLIC_STORAGE === "cloudflare";
/** Đặt khi đăng lên thư mục con, vd. GitHub Pages: /scheduler */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

// Production: static export (thư mục `out/`).
// Mặc định dữ liệu lưu trên trình duyệt (localStorage) nên `out/` chạy được trên mọi máy chủ file tĩnh.
// Chế độ Cloudflare: API /api/* do Pages Functions (thư mục `functions/`) phục vụ; khi dev, `next dev`
// proxy /api/* sang `wrangler pages dev` (cổng 8788).
const nextConfig: NextConfig = {
  basePath,
  ...(isDev
    ? isCloudflare
      ? {
          async rewrites() {
            return [{ source: "/api/:path*", destination: "http://127.0.0.1:8788/api/:path*" }];
          },
        }
      : {}
    : { output: "export", trailingSlash: true, images: { unoptimized: true } }),
};

export default nextConfig;
