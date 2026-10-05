"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buildItems, DEFAULT_BELLS, fingerprint, parseBells, readLocalStorage, scanStorage, timetableScore } from "@/lib/importer";
import { IMPORT_PICK } from "@/lib/importBridge";
import { useAuth } from "./AuthProvider";
import { TOUR_DONE_EVENT, tourDone } from "./Tour";
import { Button, Modal } from "./ui";

const dismissKey = (fp: string) => `import-dismissed-${fp}`;
/** Đã hỏi trong phiên này ("Để sau") – không hỏi lại cho đến lần mở trình duyệt sau */
const LATER_KEY = "import-later";

interface Found {
  id: string;
  fp: string;
  source: string;
  lessons: number;
  teachers: number;
  classes: number;
}

/**
 * Khi bộ nhớ trình duyệt (localStorage) có dữ liệu thời khoá biểu của app khác (vd. app GVCN / GVBM chạy
 * cùng tên miền), hỏi người dùng có muốn import vào hệ thống lịch không. Không tự nhập gì.
 */
export function ImportPrompt() {
  const { user, canBook } = useAuth();
  const router = useRouter();
  const [found, setFound] = useState<Found | null>(null);

  const check = useCallback(() => {
    try {
      if (!tourDone(user.id) || sessionStorage.getItem(LATER_KEY)) return;
    } catch {
      return;
    }
    const candidates = scanStorage(readLocalStorage())
      .map((d) => ({ d, ...timetableScore(d) }))
      .filter((c) => c.ok)
      .sort((a, b) => b.d.rows.length - a.d.rows.length);
    for (const c of candidates) {
      const fp = fingerprint(c.d);
      let dismissed = false;
      try {
        dismissed = localStorage.getItem(dismissKey(fp)) === "1";
      } catch {}
      if (dismissed) continue;
      const { items } = buildItems(c.d.rows, c.mapping, { bells: parseBells(DEFAULT_BELLS), defaultTeacher: "", roomFromClass: true, defaultRoom: "" });
      // TKB cá nhân không có cột giáo viên thì items rỗng – vẫn hỏi, số tiết tính theo số dòng
      setFound({
        id: c.d.id,
        fp,
        source: c.d.label,
        lessons: items.length || c.d.rows.length,
        teachers: new Set(items.map((i) => i.teacher)).size,
        classes: new Set(items.map((i) => i.class_name).filter(Boolean)).size,
      });
      return;
    }
  }, [user.id]);

  useEffect(() => {
    if (!canBook) return;
    const t = setTimeout(check, 900);
    window.addEventListener(TOUR_DONE_EVENT, check);
    return () => {
      clearTimeout(t);
      window.removeEventListener(TOUR_DONE_EVENT, check);
    };
  }, [check, canBook]);

  if (!found) return null;

  const answer = (choice: "yes" | "no" | "later") => {
    try {
      if (choice === "no") localStorage.setItem(dismissKey(found.fp), "1");
      if (choice === "later") sessionStorage.setItem(LATER_KEY, "1");
      if (choice === "yes") sessionStorage.setItem(IMPORT_PICK, found.id);
    } catch {}
    setFound(null);
    if (choice === "yes") router.push("/import/");
  };

  return (
    <Modal open title="Phát hiện thời khoá biểu" onClose={() => answer("later")}>
      <div className="flex flex-col gap-4 text-sm" data-testid="import-prompt">
        <p>
          Trình duyệt này đang lưu dữ liệu thời khoá biểu từ app khác (<b className="break-all">{found.source}</b>):{" "}
          <b>{found.lessons}</b> tiết
          {found.teachers > 0 && (
            <>
              , <b>{found.teachers}</b> giáo viên
            </>
          )}
          {found.classes > 0 && (
            <>
              , <b>{found.classes}</b> lớp
            </>
          )}
          .
        </p>
        <p className="text-base font-medium">Bạn có muốn import vào hệ thống lịch không?</p>
        <p className="text-white/60">Bạn sẽ xem trước, kiểm tra trùng lịch rồi mới quyết định. Chưa có gì được lưu.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={() => answer("no")}>Không, đừng hỏi lại</Button>
          <Button onClick={() => answer("later")}>Để sau</Button>
          <Button variant="primary" onClick={() => answer("yes")} data-testid="import-prompt-yes">
            Có, xem trước & import
          </Button>
        </div>
      </div>
    </Modal>
  );
}
