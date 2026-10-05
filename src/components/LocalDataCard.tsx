"use client";

import { useState, type ChangeEvent } from "react";
import { downloadBlob } from "@/lib/download";
import { today } from "@/lib/date";
import { Alert, Button, GlassCard } from "./ui";

type Confirm = { kind: "restore"; bytes: Uint8Array; name: string } | { kind: "wipe" } | null;

const backend = () => import("@/lib/local/backend");

/** Cài đặt → Dữ liệu trên trình duyệt: dung lượng, sao lưu, khôi phục, xoá (chỉ ở chế độ lưu trên trình duyệt). */
export function LocalDataCard() {
  const [info, setInfo] = useState<{ used: number; limit: number } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [message, setMessage] = useState<{ text: string; tone: "error" | "info" } | null>(null);
  const [busy, setBusy] = useState(false);

  // Đọc dung lượng khi người dùng mở chi tiết (không cần effect)
  const refresh = async () => setInfo((await backend()).storageInfo());

  async function backup() {
    setBusy(true);
    try {
      const bytes = await (await backend()).exportBackup();
      downloadBlob(`lich-sao-luu-${today()}.sqlite`, bytes as Uint8Array<ArrayBuffer>, "application/vnd.sqlite3");
      setMessage({ text: "Đã tải bản sao lưu. Hãy cất file này ở nơi an toàn (Google Drive, USB…).", tone: "info" });
    } catch (err) {
      setMessage({ text: (err as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setConfirm({ kind: "restore", bytes: new Uint8Array(await file.arrayBuffer()), name: file.name });
  }

  async function run() {
    if (!confirm) return;
    setBusy(true);
    try {
      const mod = await backend();
      if (confirm.kind === "restore") await mod.restoreBackup(confirm.bytes);
      else mod.wipeLocalData();
      // Tải lại trang: đăng nhập bằng tài khoản trong dữ liệu mới / thiết lập lại từ đầu
      location.reload();
    } catch (err) {
      setMessage({ text: (err as Error).message, tone: "error" });
      setBusy(false);
      setConfirm(null);
    }
  }

  const pct = info ? Math.min(100, Math.round((info.used / info.limit) * 100)) : 0;

  return (
    <GlassCard className="mb-4 flex flex-col gap-3 p-5" data-testid="local-data">
      <div>
        <h2 className="text-lg font-semibold">Dữ liệu trên trình duyệt này</h2>
        <p className="mt-1 text-sm text-white/60">
          Mọi dữ liệu (lịch, người, phòng, tài khoản) được lưu trong bộ nhớ của trình duyệt này (localStorage), không gửi lên máy chủ nào. Máy khác hoặc
          trình duyệt khác sẽ không thấy. Xoá dữ liệu duyệt web hay dùng chế độ ẩn danh sẽ mất dữ liệu, nên hãy tải bản sao lưu thường xuyên.
        </p>
      </div>

      <details className="text-sm" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && refresh()}>
        <summary className="cursor-pointer text-white/70">Dung lượng đã dùng</summary>
        {info && (
          <div className="mt-2 flex flex-col gap-1" data-testid="storage-usage">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full ${pct > 80 ? "bg-rose-400" : "bg-cyan-400"}`} style={{ width: `${Math.max(pct, 1)}%` }} />
            </div>
            <span className="text-xs text-white/60">
              {(info.used / 1_000_000).toFixed(2)} / {(info.limit / 1_000_000).toFixed(0)} triệu ký tự ({pct}%)
            </span>
          </div>
        )}
      </details>

      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      {confirm ? (
        <Alert>
          {confirm.kind === "restore"
            ? `Khôi phục từ “${confirm.name}” sẽ THAY TOÀN BỘ dữ liệu hiện tại. Sau đó bạn đăng nhập bằng tài khoản trong bản sao lưu.`
            : "Xoá toàn bộ dữ liệu trên trình duyệt này? Không thể hoàn tác – hãy tải bản sao lưu trước."}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="danger" disabled={busy} onClick={run} data-testid="confirm-local">
              {confirm.kind === "restore" ? "Khôi phục" : "Xoá hết"}
            </Button>
            <Button type="button" onClick={() => setConfirm(null)}>
              Huỷ
            </Button>
          </div>
        </Alert>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" disabled={busy} onClick={backup} data-testid="backup">
            ⬇ Tải bản sao lưu
          </Button>
          <label className="cursor-pointer">
            <input type="file" accept=".sqlite,.db,application/octet-stream" className="hidden" onChange={pickFile} data-testid="restore-file" />
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm hover:bg-white/15">
              ⬆ Khôi phục từ file
            </span>
          </label>
          <Button type="button" variant="danger" onClick={() => setConfirm({ kind: "wipe" })}>
            Xoá dữ liệu trên trình duyệt
          </Button>
        </div>
      )}
    </GlassCard>
  );
}
