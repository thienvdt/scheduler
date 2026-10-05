"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { MIN_PASSWORD_LENGTH } from "@/shared/types";
import { api } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import { Alert, Button, Field, Input, Modal } from "./ui";

export function UserMenu() {
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const initial = user.display_name.split(" ").pop()?.[0]?.toUpperCase() ?? "?";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Tài khoản của tôi"
        className="grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-gradient-to-br from-fuchsia-500/60 to-indigo-500/60 font-semibold shadow-lg"
      >
        {initial}
      </button>
      {open && (
        <div role="menu" className="glass-strong absolute right-0 z-50 mt-2 w-60 rounded-2xl p-2">
          <div className="px-3 py-2">
            <div className="truncate font-semibold">{user.display_name}</div>
            <div className="text-xs text-white/60">
              @{user.username} · {isAdmin ? "Quản trị viên" : "Giảng viên"}
            </div>
          </div>
          <div className="my-1 border-t border-white/10" />
          <button
            role="menuitem"
            className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white/10"
            onClick={() => {
              setOpen(false);
              setPwOpen(true);
            }}
          >
            🔑 Đổi mật khẩu
          </button>
          <button role="menuitem" className="w-full rounded-xl px-3 py-2 text-left text-sm text-rose-200 hover:bg-white/10" onClick={logout}>
            ↩ Đăng xuất
          </button>
        </div>
      )}
      {pwOpen && <ChangePasswordDialog onClose={() => setPwOpen(false)} />}
    </div>
  );
}

function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.next !== form.confirm) return setError("Mật khẩu nhập lại không khớp");
    setBusy(true);
    setError(null);
    try {
      await api.auth.changePassword(form.current, form.next);
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Modal open title="Đổi mật khẩu" onClose={onClose}>
      {done ? (
        <div className="flex flex-col gap-4">
          <Alert tone="info">Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.</Alert>
          <Button onClick={onClose}>Đóng</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          {error && <Alert>{error}</Alert>}
          <Field label="Mật khẩu hiện tại">
            <Input type="password" required autoComplete="current-password" value={form.current} onChange={(e) => set("current", e.target.value)} />
          </Field>
          <Field label={`Mật khẩu mới (tối thiểu ${MIN_PASSWORD_LENGTH} ký tự)`}>
            <Input
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              value={form.next}
              onChange={(e) => set("next", e.target.value)}
            />
          </Field>
          <Field label="Nhập lại mật khẩu mới">
            <Input type="password" required autoComplete="new-password" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={onClose}>
              Huỷ
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Đang lưu…" : "Đổi mật khẩu"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
