"use client";

import { useState, useSyncExternalStore } from "react";
import { Button, Modal } from "./ui";

// Sự kiện `beforeinstallprompt` (Chrome/Edge trên máy tính & Android) – chưa có trong lib DOM của TypeScript
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ---- Store dùng chung, đăng ký ngay khi module được tải để không lỡ sự kiện bắn ra trước khi React render ----

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // tự hiện nút của app thay cho banner mặc định
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferredPrompt = null;
    emit();
  });
  if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", listener);
  };
}

type Platform = "ios" | "mac-safari" | "android" | "desktop";

interface InstallState {
  /** Đang chạy dưới dạng app đã cài */
  standalone: boolean;
  canPrompt: boolean;
  platform: Platform;
  mobile: boolean;
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS báo là "Macintosh" nhưng có màn hình cảm ứng
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua)) return "mac-safari";
  return "desktop";
}

let cached: InstallState | null = null;
function getSnapshot(): InstallState {
  const platform = detectPlatform();
  const next: InstallState = {
    standalone:
      installed ||
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    canPrompt: deferredPrompt !== null,
    platform,
    mobile: platform === "ios" || platform === "android",
  };
  // useSyncExternalStore cần cùng một object khi không có gì thay đổi
  if (cached && JSON.stringify(cached) === JSON.stringify(next)) return cached;
  cached = next;
  return next;
}

const SERVER_SNAPSHOT: InstallState = { standalone: true, canPrompt: false, platform: "desktop", mobile: false };
const getServerSnapshot = () => SERVER_SNAPSHOT; // không render nút khi prerender

export function InstallButton() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [guideOpen, setGuideOpen] = useState(false);

  if (state.standalone) return null;

  async function install() {
    if (deferredPrompt) {
      const prompt = deferredPrompt;
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      // Mỗi sự kiện chỉ prompt() được một lần
      deferredPrompt = null;
      if (outcome === "accepted") installed = true;
      emit();
      return;
    }
    setGuideOpen(true);
  }

  const label = state.mobile ? "📲 Lưu ra màn hình" : "💻 Cài lên máy tính";

  return (
    <>
      <Button variant="primary" className="px-3 py-1.5" onClick={install} title="Cài Lịch Giảng như một ứng dụng">
        {label}
      </Button>
      <Modal open={guideOpen} title={state.mobile ? "Lưu ra màn hình chính" : "Cài lên máy tính"} onClose={() => setGuideOpen(false)}>
        <InstallGuide platform={state.platform} />
        <div className="mt-5 flex justify-end">
          <Button onClick={() => setGuideOpen(false)}>Đã hiểu</Button>
        </div>
      </Modal>
    </>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/25 bg-white/10 text-sm font-semibold">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

function InstallGuide({ platform }: { platform: Platform }) {
  if (platform === "ios") {
    return (
      <ol className="space-y-3 text-sm">
        <Step n={1}>Mở trang này bằng <b>Safari</b>.</Step>
        <Step n={2}>
          Nhấn nút <b>Chia sẻ</b> <span className="rounded bg-white/15 px-1.5">⬆︎</span> ở thanh dưới cùng (iPad: góc trên bên phải).
        </Step>
        <Step n={3}>
          Chọn <b>Thêm vào MH chính</b> (Add to Home Screen) rồi nhấn <b>Thêm</b>.
        </Step>
      </ol>
    );
  }
  if (platform === "mac-safari") {
    return (
      <ol className="space-y-3 text-sm">
        <Step n={1}>
          Trên thanh menu chọn <b>Tệp → Thêm vào Dock…</b> (File → Add to Dock, cần macOS Sonoma trở lên).
        </Step>
        <Step n={2}>Nhấn <b>Thêm</b>. App xuất hiện trong Dock và thư mục Ứng dụng.</Step>
        <Step n={3}>Muốn có biểu tượng trên Desktop: mở Finder → Ứng dụng, kéo “Lịch Giảng” ra Desktop.</Step>
      </ol>
    );
  }
  if (platform === "android") {
    return (
      <ol className="space-y-3 text-sm">
        <Step n={1}>Mở trang này bằng <b>Chrome</b>.</Step>
        <Step n={2}>
          Nhấn menu <span className="rounded bg-white/15 px-1.5">⋮</span> → <b>Thêm vào màn hình chính</b> (hoặc <b>Cài đặt ứng dụng</b>).
        </Step>
        <Step n={3}>Xác nhận <b>Cài đặt</b>.</Step>
      </ol>
    );
  }
  return (
    <ol className="space-y-3 text-sm">
      <Step n={1}>
        Mở trang này bằng <b>Chrome</b> hoặc <b>Edge</b> (Firefox chưa hỗ trợ cài app).
      </Step>
      <Step n={2}>
        Nhấn biểu tượng <b>Cài đặt</b> <span className="rounded bg-white/15 px-1.5">⊕</span> ở cuối thanh địa chỉ, hoặc menu{" "}
        <span className="rounded bg-white/15 px-1.5">⋮</span> → <b>Truyền, lưu và chia sẻ → Cài đặt trang dưới dạng ứng dụng</b>.
      </Step>
      <Step n={3}>
        Trên Windows, Chrome/Edge sẽ hỏi tạo lối tắt trên <b>Desktop</b> – hãy chọn có. App cũng có trong menu Start / thư mục
        Ứng dụng.
      </Step>
    </ol>
  );
}
