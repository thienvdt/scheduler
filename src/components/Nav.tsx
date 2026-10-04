"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { InstallButton } from "./InstallButton";
import { cn } from "./ui";

const links = [
  { href: "/", label: "Lịch" },
  { href: "/teachers/", label: "Giảng viên" },
  { href: "/rooms/", label: "Phòng học" },
  { href: "/templates/", label: "Mẫu lịch" },
  { href: "/reports/", label: "Báo cáo" },
];

export function Nav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, "")));

  return (
    // Điện thoại: không dính đầu trang để không che nội dung khi cuộn
    <header className="z-40 px-4 pt-4 sm:sticky sm:top-0 sm:px-6">
      <nav className="glass mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-cyan-400 text-sm shadow-lg shadow-cyan-900/40">
            📅
          </span>
          <span>Lịch Giảng</span>
        </Link>
        <div className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto px-1 sm:order-2 sm:ml-auto sm:w-auto">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "shrink-0 rounded-xl px-3 py-1.5 text-sm transition",
                isActive(l.href) ? "bg-white/20 text-white shadow-inner" : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="order-2 ml-auto sm:order-3 sm:ml-0">
          <InstallButton />
        </div>
      </nav>
    </header>
  );
}
