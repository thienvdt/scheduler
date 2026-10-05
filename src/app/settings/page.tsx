"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { IS_LOCAL } from "@/lib/mode";
import { LocalDataCard } from "@/components/LocalDataCard";
import { useResource } from "@/lib/useResource";
import type { SampleCounts } from "@/lib/api";
import type { ProfileId } from "@/shared/types";
import { PROFILES } from "@/shared/profiles";
import { api } from "@/lib/api";
import { ProfilePicker, useAuth } from "@/components/AuthProvider";
import { Alert, Button, Field, GlassCard, Input, PageHeader } from "@/components/ui";

export default function SettingsPage() {
  const { isAdmin, settings, setSettings } = useAuth();
  const [profile, setProfile] = useState<ProfileId>(settings.profile);
  const [orgName, setOrgName] = useState(settings.org_name);
  const [addTemplates, setAddTemplates] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "error" | "info" } | null>(null);
  const sample = useResource(api.settings.sampleCounts, { people: 0, rooms: 0, sessions: 0 } as SampleCounts);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  async function runSample(action: "load" | "clear") {
    setSampleBusy(true);
    setMessage(null);
    try {
      const c = await api.settings.sample(action);
      sample.mutate(() => c);
      setConfirmClear(false);
      setMessage({
        text: action === "load"
          ? `Đã nạp dữ liệu mẫu: ${c.people} ${PROFILES[settings.profile].people.toLowerCase()}, ${c.rooms} ${PROFILES[settings.profile].room.toLowerCase()}, ${c.sessions} lịch trong tuần này và các tuần tới.`
          : "Đã xoá toàn bộ dữ liệu mẫu.",
        tone: "info",
      });
    } catch (err) {
      setMessage({ text: (err as Error).message, tone: "error" });
    } finally {
      setSampleBusy(false);
    }
  }

  if (!isAdmin) return <Alert>Chỉ quản trị viên mới xem được trang này.</Alert>;

  const changed = profile !== settings.profile;
  const next = PROFILES[profile];

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const saved = await api.settings.update({ profile, org_name: orgName, add_templates: changed && addTemplates });
      setSettings(saved);
      setMessage({
        text: changed && addTemplates ? `Đã lưu và thêm ${next.templates.length} mẫu lịch của loại hình “${next.label}”.` : "Đã lưu cài đặt.",
        tone: "info",
      });
    } catch (err) {
      setMessage({ text: (err as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <PageHeader
        title="Cài đặt"
        subtitle="Áp dụng cho toàn bộ người dùng của đơn vị."
        actions={
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu cài đặt"}
          </Button>
        }
      />

      {message && (
        <div className="mb-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      {IS_LOCAL && <LocalDataCard />}

      <GlassCard className="mb-4 p-5">
        <Field label="Tên đơn vị">
          <Input value={orgName} placeholder={next.appName} maxLength={100} onChange={(e) => setOrgName(e.target.value)} />
        </Field>
        <p className="mt-2 text-xs text-white/50">Hiện trên thanh điều hướng, màn hình đăng nhập và tên tab. Để trống: “{next.appName}”.</p>
      </GlassCard>

      <GlassCard className="mb-4 flex flex-col gap-3 p-5" >
        <div>
          <h2 className="text-lg font-semibold">Dữ liệu mẫu</h2>
          <p className="mt-1 text-sm text-white/60">
            Nạp người, phòng và lịch ví dụ ({PROFILES[settings.profile].label.toLowerCase()}) để thử app ngay. Lịch được đặt vào tuần này và
            lặp vài tuần tới. Dữ liệu mẫu có mã riêng nên xoá sạch được bất cứ lúc nào, không ảnh hưởng dữ liệu thật.
          </p>
        </div>
        <div className="text-sm text-white/70" id="sample-status">
          {sample.loading
            ? "Đang kiểm tra…"
            : sample.data.sessions
            ? `Đang có: ${sample.data.people} người · ${sample.data.rooms} phòng · ${sample.data.sessions} lịch mẫu`
            : "Chưa có dữ liệu mẫu."}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" disabled={sampleBusy} onClick={() => runSample("load")} id="load-sample">
            {sampleBusy ? "Đang xử lý…" : sample.data.sessions ? "Nạp lại dữ liệu mẫu" : "Nạp dữ liệu mẫu"}
          </Button>
          {sample.data.sessions > 0 &&
            (confirmClear ? (
              <>
                <Button type="button" variant="danger" disabled={sampleBusy} onClick={() => runSample("clear")}>
                  Xác nhận xoá dữ liệu mẫu
                </Button>
                <Button type="button" onClick={() => setConfirmClear(false)}>
                  Giữ lại
                </Button>
              </>
            ) : (
              <Button type="button" variant="danger" onClick={() => setConfirmClear(true)}>
                Xoá dữ liệu mẫu
              </Button>
            ))}
        </div>
      </GlassCard>

      <GlassCard className="mb-4 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="text-lg font-semibold">Nhập thời khoá biểu</h2>
          <p className="mt-1 text-sm text-white/60">Từ app GVCN / GVBM, file CSV (Excel) hoặc JSON. Tự tạo giáo viên, phòng còn thiếu và bỏ qua tiết trùng.</p>
        </div>
        <Link href="/import/">
          <Button type="button">📥 Nhập dữ liệu</Button>
        </Link>
      </GlassCard>

      <h2 className="mb-3 text-lg font-semibold">Loại hình sử dụng</h2>
      <ProfilePicker value={profile} onChange={setProfile} />

      {changed && (
        <GlassCard className="mt-4 flex flex-col gap-3 p-5 text-sm">
          <div>
            Khi đổi sang <b>{next.label}</b>: cách gọi đổi thành <b>{next.people}</b>, <b>{next.room}</b>, <b>{next.group}</b>; loại lịch
            hiển thị theo loại hình mới. Dữ liệu cũ (lịch, người, phòng) giữ nguyên.
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={addTemplates} onChange={(e) => setAddTemplates(e.target.checked)} className="accent-cyan-400" />
            Thêm {next.templates.length} mẫu lịch mặc định của loại hình này (mẫu hiện có không bị xoá)
          </label>
        </GlassCard>
      )}
    </form>
  );
}
