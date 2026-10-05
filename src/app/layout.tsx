import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { Nav } from "@/components/Nav";
import { AuthProvider } from "@/components/AuthProvider";
import { BASE_PATH } from "@/lib/basePath";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Lịch – Đặt lịch giảng dạy, họp, công tác",
  description: "Đặt lịch cho trường học, doanh nghiệp, văn phòng: tự phát hiện trùng lịch, mẫu lịch, tìm giờ trống.",
  manifest: `${BASE_PATH}/manifest.webmanifest`,
  applicationName: "Lịch",
  appleWebApp: { capable: true, title: "Lịch", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: `${BASE_PATH}/icon.svg`, type: "image/svg+xml" }, { url: `${BASE_PATH}/icon-192.png`, sizes: "192x192" }],
    apple: `${BASE_PATH}/apple-touch-icon.png`,
  },
};

export const viewport: Viewport = {
  themeColor: "#1e1b4b",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${beVietnam.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <div className="glass-bg" aria-hidden>
          <div className="blob blob-1" />
          <div className="blob blob-2" />
          <div className="blob blob-3" />
        </div>
        <AuthProvider>
          <Nav />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
