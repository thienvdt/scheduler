"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";

const links = [
  { href: "/", label: "Lịch giảng" },
  { href: "/teachers/", label: "Giảng viên" },
  { href: "/rooms/", label: "Phòng học" },
];

export function Nav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, "")));

  return (
    <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6">
      <nav className="glass mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-cyan-400 text-sm shadow-lg shadow-cyan-900/40">
            📅
          </span>
          <span>Lịch Giảng</span>
        </Link>
        <div className="flex gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-xl px-3 py-1.5 text-sm transition",
                isActive(l.href) ? "bg-white/20 text-white shadow-inner" : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
