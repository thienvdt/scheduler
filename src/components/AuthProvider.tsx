"use client";

import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { AuthState, ProfileId, Session, Settings, User } from "@/shared/types";
import { MIN_PASSWORD_LENGTH, PROFILE_IDS } from "@/shared/types";
import { getProfile, PROFILES, type Profile } from "@/shared/profiles";
import { api, AUTH_REQUIRED_EVENT } from "@/lib/api";
import { Alert, Button, Field, GlassCard, Input } from "./ui";

interface AuthContextValue {
  user: User;
  isAdmin: boolean;
  /** Quản trị viên: mọi lịch; giảng viên: lịch do mình chủ trì */
  canEdit: (s: Pick<Session, "teacher_id">) => boolean;
  /** Có thể đặt lịch mới không (giảng viên cần được liên kết với hồ sơ giảng viên) */
  canBook: boolean;
  logout: () => Promise<void>;
  settings: Settings;
  /** Cách gọi, loại lịch… theo loại hình đơn vị */
  terms: Profile;
  /** Tên hiển thị: tên đơn vị, hoặc tên app theo loại hình */
  appName: string;
  setSettings: (s: Settings) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Cách gọi theo loại hình đơn vị (giảng viên / nhân viên / cán bộ…). */
export function useTerms(): Profile {
  return useAuth().terms;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải dùng bên trong AuthProvider");
  return ctx;
}

type Status = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; auth: AuthState };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>({ state: "loading" });

  const load = useCallback(() => {
    api.auth.me().then(
      (auth) => setStatus({ state: "ready", auth }),
      (err: Error) => setStatus({ state: "error", message: err.message }),
    );
  }, []);

  useEffect(() => {
    let stale = false;
    api.auth.me().then(
      (auth) => !stale && setStatus({ state: "ready", auth }),
      (err: Error) => !stale && setStatus({ state: "error", message: err.message }),
    );
    // Hết phiên giữa chừng → về màn hình đăng nhập
    const onExpired = () =>
      setStatus((s) => (s.state === "ready" ? { state: "ready", auth: { ...s.auth, user: null, needs_setup: false } } : s));
    window.addEventListener(AUTH_REQUIRED_EVENT, onExpired);
    return () => {
      stale = true;
      window.removeEventListener(AUTH_REQUIRED_EVENT, onExpired);
    };
  }, []);

  if (status.state === "loading") {
    return <div className="grid flex-1 place-items-center py-24 text-white/60">Đang tải…</div>;
  }
  if (status.state === "error") {
    return (
      <CenteredCard title="Không kết nối được máy chủ">
        <Alert>{status.message}</Alert>
        <Button className="mt-4 w-full" onClick={load}>
          Thử lại
        </Button>
      </CenteredCard>
    );
  }

  const { auth } = status;
  const terms = getProfile(auth.settings?.profile);
  const appName = auth.settings?.org_name || terms.appName;
  const onAuth = (next: AuthState) => setStatus({ state: "ready", auth: next });
  if (!auth.user) {
    return (
      <>
        <DocumentTitle title={appName} />
        {auth.needs_setup ? <SetupScreen onDone={onAuth} /> : <LoginScreen onDone={onAuth} appName={appName} />}
      </>
    );
  }

  const user = auth.user;
  const value: AuthContextValue = {
    user,
    isAdmin: user.role === "admin",
    canEdit: (s) => user.role === "admin" || (!!user.teacher_id && s.teacher_id === user.teacher_id),
    canBook: user.role === "admin" || !!user.teacher_id,
    logout: async () => {
      await api.auth.logout().catch(() => {});
      setStatus({ state: "ready", auth: { ...auth, user: null, needs_setup: false } });
    },
    settings: auth.settings,
    terms,
    appName,
    setSettings: (settings) => setStatus({ state: "ready", auth: { ...auth, settings } }),
  };
  return (
    <AuthContext.Provider value={value}>
      <DocumentTitle title={appName} />
      {children}
    </AuthContext.Provider>
  );
}

function DocumentTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = title;
  }, [title]);
  return null;
}

function CenteredCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <GlassCard className="w-full max-w-sm p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-400 to-cyan-400 text-2xl shadow-lg shadow-cyan-900/40">
            📅
          </span>
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-white/60">{subtitle}</p>}
        </div>
        {children}
      </GlassCard>
    </div>
  );
}

function LoginScreen({ onDone, appName }: { onDone: (a: AuthState) => void; appName: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onDone(await api.auth.login(username, password));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <CenteredCard title={`Đăng nhập ${appName}`} subtitle="Dùng tài khoản do quản trị viên cấp">
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Tên đăng nhập">
          <Input autoFocus required autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </Field>
        <Field label="Mật khẩu">
          <Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary" disabled={busy} className="mt-2">
          {busy ? "Đang đăng nhập…" : "Đăng nhập"}
        </Button>
        <p className="text-center text-xs text-white/50">Quên mật khẩu? Liên hệ quản trị viên để được đặt lại.</p>
      </form>
    </CenteredCard>
  );
}

function SetupScreen({ onDone }: { onDone: (a: AuthState) => void }) {
  const [form, setForm] = useState({ display_name: "", username: "admin", password: "", confirm: "", org_name: "" });
  const [profile, setProfile] = useState<ProfileId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) return setError("Mật khẩu nhập lại không khớp");
    setBusy(true);
    setError(null);
    try {
      onDone(
        await api.auth.setup({
          display_name: form.display_name,
          username: form.username,
          password: form.password,
          profile: profile ?? "education",
          org_name: form.org_name,
        }),
      );
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Bước 1: chọn loại hình sử dụng
  if (!profile) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-3xl">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold sm:text-3xl">Bạn dùng lịch cho…</h1>
            <p className="mt-2 text-sm text-white/60">
              App sẽ đổi cách gọi, loại lịch và mẫu lịch cho phù hợp. Có thể đổi lại trong Cài đặt.
            </p>
          </div>
          <ProfilePicker value={null} onChange={setProfile} />
        </div>
      </div>
    );
  }

  const terms = PROFILES[profile];
  return (
    <CenteredCard title="Thiết lập lần đầu" subtitle={`${terms.icon} ${terms.label} · Tạo tài khoản quản trị viên`}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Tên đơn vị (tuỳ chọn)">
          <Input value={form.org_name} placeholder={terms.appName} onChange={(e) => set("org_name", e.target.value)} />
        </Field>
        <Field label="Họ tên">
          <Input autoFocus required value={form.display_name} onChange={(e) => set("display_name", e.target.value)} />
        </Field>
        <Field label="Tên đăng nhập">
          <Input required autoComplete="username" value={form.username} onChange={(e) => set("username", e.target.value)} />
        </Field>
        <Field label={`Mật khẩu (tối thiểu ${MIN_PASSWORD_LENGTH} ký tự)`}>
          <Input
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
          />
        </Field>
        <Field label="Nhập lại mật khẩu">
          <Input type="password" required autoComplete="new-password" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} />
        </Field>
        <Button type="submit" variant="primary" disabled={busy} className="mt-2">
          {busy ? "Đang tạo…" : "Tạo tài khoản quản trị"}
        </Button>
        <button type="button" className="text-xs text-white/50 hover:text-white" onClick={() => setProfile(null)}>
          ← Chọn loại hình khác
        </button>
      </form>
    </CenteredCard>
  );
}

/** Các thẻ chọn loại hình sử dụng (dùng ở thiết lập lần đầu và trang Cài đặt). */
export function ProfilePicker({ value, onChange }: { value: ProfileId | null; onChange: (p: ProfileId) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {PROFILE_IDS.map((id) => {
        const p = PROFILES[id];
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={active}
            className={`glass flex flex-col items-start gap-2 rounded-2xl p-5 text-left transition hover:scale-[1.02] hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 ${
              active ? "ring-2 ring-cyan-300/80" : ""
            }`}
          >
            <span className="text-3xl">{p.icon}</span>
            <span className="text-lg font-semibold">{p.label}</span>
            <span className="text-sm text-white/60">{p.description}</span>
            <span className="mt-1 text-xs text-white/50">
              {p.people} · {p.room} · {p.group}
            </span>
          </button>
        );
      })}
    </div>
  );
}
