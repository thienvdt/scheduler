"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import { Button } from "./ui";

/** Phát sự kiện này để mở lại tour từ bất kỳ đâu (vd. menu tài khoản). */
export const TOUR_EVENT = "lich-giang:tour";
/** Phát sau khi nạp dữ liệu mẫu để các trang tải lại dữ liệu. */
export const DATA_CHANGED_EVENT = "lich-giang:data-changed";
/** Đặt cờ này (sessionStorage) trước khi chuyển về trang Lịch để tour tự mở */
export const TOUR_PENDING = "tour-pending";

const doneKey = (userId: string) => `tour-done-${userId}`;

interface Step {
  /** Giá trị data-tour của phần tử cần làm nổi bật; bỏ trống = hộp giữa màn hình */
  target?: string;
  title: string;
  body: ReactNode;
}

interface Rect { top: number; left: number; width: number; height: number }

const PAD = 8;
/** Chiều cao ước lượng của bong bóng để chọn đặt trên hay dưới */
const BUBBLE_H = 230;

/** Phần tử đang hiển thị (nút cài app đã ẩn, menu ẩn trên điện thoại… thì bỏ qua bước đó) */
function findTarget(target: string) {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
}

/**
 * Tour hướng dẫn ngay trên trang: làm nổi bật từng nút với bong bóng giải thích.
 * Tự mở lần đầu mỗi tài khoản đăng nhập; mở lại bằng menu tài khoản → Hướng dẫn.
 */
export function Tour({ hasData }: { hasData: boolean }) {
  const { user, isAdmin, terms, appName } = useAuth();
  const [index, setIndex] = useState<number | null>(null);
  const [rectState, setRect] = useState<(Rect & { index: number }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const person = terms.person.toLowerCase();
  const steps: Step[] = [
    {
      title: `Chào mừng đến ${appName} 👋`,
      body: (
        <>
          <p>Hướng dẫn nhanh khoảng 1 phút: mình sẽ chỉ từng nút trên trang này. Bấm <b>Tiếp</b> để đi tiếp, <b>Esc</b> để bỏ qua.</p>
          {isAdmin && !hasData && !loaded && (
            <p className="mt-2">
              Hệ thống đang trống. Nạp <b>dữ liệu mẫu</b> ({terms.label.toLowerCase()}) để có sẵn người, phòng và lịch mà thử ngay – xoá sạch được
              trong Cài đặt.
            </p>
          )}
          {loaded && <p className="mt-2 text-emerald-200">✓ Đã nạp dữ liệu mẫu. Lịch tuần này đã có sẵn để bạn thử.</p>}
        </>
      ),
    },
    {
      target: "nav",
      title: "Menu chính",
      body: (
        <>
          <p>
            <b>{terms.people}</b> và <b>{terms.room}</b>: danh sách người và phòng. <b>Mẫu lịch</b>: các mẫu họp, coi thi… để đặt nhanh.{" "}
            <b>Báo cáo</b>: tổng giờ theo từng {person}, xuất Excel.
          </p>
          {isAdmin && (
            <p className="mt-2">
              <b>Tài khoản</b>: cấp tài khoản cho từng {person}. <b>Cài đặt</b>: đổi loại hình, tên đơn vị, nạp / xoá dữ liệu mẫu.
            </p>
          )}
        </>
      ),
    },
    {
      target: "new",
      title: "Đặt lịch",
      body: (
        <p>
          Mở form đặt lịch: chọn loại lịch, {person} chủ trì, phòng, ngày giờ, lặp hằng tuần và người tham dự. App{" "}
          <b>tự chặn nếu trùng người hoặc trùng phòng</b> và chỉ rõ trùng với lịch nào.
        </p>
      ),
    },
    {
      target: "template",
      title: "Đặt nhanh từ mẫu",
      body: <p>Chọn một mẫu (vd. họp, coi thi, gặp khách…) – tiêu đề, thời lượng, giờ, phòng và nội dung được điền sẵn, chỉ cần chỉnh rồi lưu.</p>,
    },
    {
      target: "voice",
      title: "Nói để đặt lịch",
      body: (
        <>
          <p>Bấm micro rồi nói một câu, app tự điền form để bạn kiểm tra. Ví dụ:</p>
          <p className="mt-1 italic text-white/80">“{terms.voiceExample}”</p>
        </>
      ),
    },
    {
      target: "finder",
      title: "Tìm giờ trống",
      body: <p>Chọn những người cần có mặt và thời lượng – app liệt kê các khung giờ mọi người cùng rảnh và còn phòng trống. Bấm một khung để đặt luôn.</p>,
    },
    {
      target: "calendar",
      title: "Lịch tuần",
      body: (
        <ul className="list-disc space-y-1 pl-4">
          <li>Bấm vào <b>ô trống</b> để đặt lịch đúng ngày giờ đó.</li>
          <li>Bấm vào <b>một lịch</b> để xem, sửa, huỷ hoặc xoá.</li>
          <li>Dùng chuột <b>kéo khối lịch</b> để đổi giờ/ngày, kéo <b>mép dưới</b> để đổi thời lượng.</li>
        </ul>
      ),
    },
    {
      target: "toolbar",
      title: "Xem và lọc",
      body: (
        <p>
          Chuyển <b>Tuần / Danh sách</b> (điện thoại dùng danh sách), đổi tuần bằng ‹ ›, lọc theo {person}, loại lịch, phòng. Nút <b>Xuất .ics</b> đưa
          lịch sang Google Calendar, Outlook hoặc điện thoại.
        </p>
      ),
    },
    {
      target: "stats",
      title: "Tổng quan tuần",
      body: <p>Số lịch, tổng giờ và số lịch đã huỷ của tuần đang xem – thay đổi theo bộ lọc.</p>,
    },
    {
      target: "install",
      title: "Cài như ứng dụng",
      body: <p>Đưa app ra màn hình điện thoại hoặc cài lên máy tính để mở nhanh như một ứng dụng.</p>,
    },
    {
      target: "usermenu",
      title: "Tài khoản của bạn",
      body: <p>Đổi mật khẩu, đăng xuất, và mở lại <b>hướng dẫn</b> này bất cứ lúc nào.</p>,
    },
    {
      title: "Xong! 🎉",
      body: (
        <p>
          Thử ngay: bấm một ô trống trên lịch để đặt lịch đầu tiên{isAdmin ? `, hoặc vào ${terms.people} để thêm người của đơn vị bạn` : ""}.
        </p>
      ),
    },
  ];

  const finish = useCallback(() => {
    setIndex(null);
    try {
      localStorage.setItem(doneKey(user.id), "1");
    } catch {}
  }, [user.id]);

  /** Bước kế tiếp theo hướng dir mà phần tử của nó đang hiển thị (bước không có target luôn hợp lệ) */
  const targets = steps.map((s) => s.target);
  const total = steps.length;
  const go = useCallback(
    (from: number, dir: 1 | -1) => {
      for (let i = from + dir; i >= 0 && i < total; i += dir) {
        const t = targets[i];
        if (!t || findTarget(t)) return setIndex(i);
      }
    },
    // targets chỉ phụ thuộc vào quyền, đổi cùng lúc với total
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [total],
  );

  // Mở tour lần đầu, hoặc khi được gọi từ menu / đường dẫn #tour
  useEffect(() => {
    let done = false;
    let pending = location.hash === "#tour";
    try {
      done = localStorage.getItem(doneKey(user.id)) === "1";
      if (sessionStorage.getItem(TOUR_PENDING) === "1") pending = true;
      sessionStorage.removeItem(TOUR_PENDING);
    } catch {}
    const start = () => setIndex(0);
    const timer = !done || pending ? setTimeout(start, 600) : undefined;
    if (location.hash === "#tour") history.replaceState(null, "", location.pathname);
    window.addEventListener(TOUR_EVENT, start);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(TOUR_EVENT, start);
    };
  }, [user.id]);

  const step = index === null ? null : steps[index];
  const target = step?.target;

  // Vị trí phần tử đang được giới thiệu (gắn với bước để không dùng nhầm vị trí của bước trước)
  useEffect(() => {
    if (index === null || !target) return;
    const el = findTarget(target);
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setRect({ index, top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
    };
    el.scrollIntoView({ block: el.offsetHeight > window.innerHeight * 0.6 ? "start" : "center", behavior: "smooth" });
    const frame = requestAnimationFrame(measure);
    const t = setTimeout(measure, 400);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [index, target]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") go(index, 1);
      if (e.key === "ArrowLeft") go(index, -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go, finish]);

  if (index === null || !step) return null;

  async function loadSample() {
    setLoading(true);
    try {
      await api.settings.sample("load");
      setLoaded(true);
      window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
    } finally {
      setLoading(false);
    }
  }

  const last = index === steps.length - 1;
  const rect = rectState && rectState.index === index ? rectState : null;
  const centered = !step.target || !rect;

  // Bong bóng: dưới phần tử nếu còn chỗ, không thì phía trên; luôn nằm trong màn hình
  const W = Math.min(360, window.innerWidth - 24);
  let bubble: React.CSSProperties = { width: W, left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  if (!centered && rect) {
    const below = rect.top + rect.height + 12;
    const left = Math.max(12, Math.min(rect.left + rect.width / 2 - W / 2, window.innerWidth - W - 12));
    if (below + BUBBLE_H < window.innerHeight) bubble = { width: W, left, top: below };
    else if (rect.top - 12 - BUBBLE_H > 0) bubble = { width: W, left, top: rect.top - 12, transform: "translateY(-100%)" };
    // Phần tử cao hơn màn hình (vd. lịch tuần): đặt bong bóng ở góc dưới, đè lên phần tử
    else bubble = { width: W, left: Math.max(12, window.innerWidth - W - 16), top: window.innerHeight - 16, transform: "translateY(-100%)" };
  }

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={`Hướng dẫn: ${step.title}`}>
      {centered ? (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px]" onClick={finish} />
      ) : (
        <>
          {/* Lớp chặn bấm + vùng sáng quanh phần tử */}
          <div className="absolute inset-0" onClick={finish} />
          <div
            className="pointer-events-none absolute rounded-2xl ring-2 ring-cyan-300/90 transition-all duration-300"
            style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, boxShadow: "0 0 0 9999px rgba(5, 8, 25, 0.72), 0 0 24px rgba(34, 211, 238, 0.55)" }}
          />
        </>
      )}
      <div className="glass-strong absolute rounded-2xl p-4 text-sm leading-relaxed text-white/90" style={bubble}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-white">{step.title}</h3>
          <span className="shrink-0 font-mono text-xs text-white/50">
            {index + 1}/{steps.length}
          </span>
        </div>
        <div>{step.body}</div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {index === 0 && isAdmin && !hasData && !loaded && (
            <Button variant="primary" onClick={loadSample} disabled={loading} data-tour-action="sample">
              {loading ? "Đang nạp…" : "Nạp dữ liệu mẫu"}
            </Button>
          )}
          <button type="button" onClick={finish} className="text-xs text-white/50 hover:text-white">
            Bỏ qua
          </button>
          <div className="ml-auto flex gap-2">
            {index > 0 && <Button onClick={() => go(index, -1)}>Quay lại</Button>}
            <Button variant="primary" onClick={() => (last ? finish() : go(index, 1))} data-tour-action="next">
              {last ? "Bắt đầu dùng" : "Tiếp"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
