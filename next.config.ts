import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Production: static export (thư mục `out/`) để deploy lên Cloudflare Pages.
// API /api/* do Pages Functions (thư mục `functions/`) phục vụ.
// Dev: `next dev` proxy /api/* sang `wrangler pages dev` (cổng 8788).
const nextConfig: NextConfig = isDev
  ? {
      async rewrites() {
        return [{ source: "/api/:path*", destination: "http://127.0.0.1:8788/api/:path*" }];
      },
    }
  : {
      output: "export",
      trailingSlash: true,
      images: { unoptimized: true },
    };

export default nextConfig;
