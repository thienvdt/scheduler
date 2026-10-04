import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Lịch Giảng – Quản lý lịch giảng dạy",
  description: "Đặt lịch giảng, quản lý giảng viên và phòng học, tự động phát hiện trùng lịch.",
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
        <Nav />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
