"use client";

import { useState, type FormEvent } from "react";
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

      <GlassCard className="mb-4 p-5">
        <Field label="Tên đơn vị">
          <Input value={orgName} placeholder={next.appName} maxLength={100} onChange={(e) => setOrgName(e.target.value)} />
        </Field>
        <p className="mt-2 text-xs text-white/50">Hiện trên thanh điều hướng, màn hình đăng nhập và tên tab. Để trống: “{next.appName}”.</p>
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
