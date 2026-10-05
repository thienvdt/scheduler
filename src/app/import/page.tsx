"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Link from "next/link";
import type { ImportRequest, ImportResult, Teacher } from "@/shared/types";
import { KIND_META, MAX_REPEAT_WEEKS } from "@/shared/types";
import { api } from "@/lib/api";
import { useResource } from "@/lib/useResource";
import { startOfWeek, today, formatFull } from "@/lib/date";
import {
  DEFAULT_BELLS, FIELDS, FIELD_LABELS, buildItems, markImported, norm, parseBells, parseFileText, readLocalStorage, scanStorage, timetableScore,
  type Dataset, type Mapping,
} from "@/lib/importer";
import { BRIDGE_READY, IMPORT_PICK, bookmarklet, readBridgeMessage, type Bridged } from "@/lib/importBridge";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Button, cn, Field, GlassCard, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { DATA_CHANGED_EVENT } from "@/components/Tour";

const DAY_LABELS = ["", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];
const PREVIEW_ROWS = 40;

export default function ImportPage() {
  const { user, isAdmin, terms } = useAuth();
  const { data: teachers } = useResource(api.teachers.list, [] as Teacher[]);
  const ownName = teachers.find((t) => t.id === user.teacher_id)?.name ?? user.display_name;

  // ---- Nguồn dữ liệu ----
  const [localSets] = useState<Dataset[]>(() => scanStorage(readLocalStorage()));
  const [bridged, setBridged] = useState<Bridged | null>(null);
  const [waitingBridge] = useState(() => new URLSearchParams(location.search).get("bridge") === "1" && !!window.opener);
  const [fileSets, setFileSets] = useState<Dataset[]>([]);
  const [paste, setPaste] = useState("");
  const [sourceError, setSourceError] = useState<string | null>(null);

  // Nhận dữ liệu từ bookmarklet chạy trên app kia
  useEffect(() => {
    if (!waitingBridge) return;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window.opener) return;
      const data = readBridgeMessage(e);
      if (data) setBridged(data);
    };
    window.addEventListener("message", onMessage);
    (window.opener as Window).postMessage({ type: BRIDGE_READY }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, [waitingBridge]);

  const bridgedSets = useMemo(
    () => (bridged ? scanStorage(bridged.entries).map((d) => ({ ...d, id: `bridge:${d.id}`, label: `${new URL(bridged.origin).host} › ${d.label}` })) : []),
    [bridged],
  );
  const datasets = useMemo(() => [...bridgedSets, ...fileSets, ...localSets], [bridgedSets, fileSets, localSets]);
  const scored = useMemo(() => datasets.map((d) => ({ d, ...timetableScore(d) })), [datasets]);

  const [pickedId, setPickedId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(IMPORT_PICK);
    } catch {
      return null;
    }
  });
  const current = scored.find((s) => s.d.id === pickedId) ?? scored.find((s) => s.ok) ?? scored[0] ?? null;

  // ---- Ghép cột & tuỳ chọn ----
  const [overrides, setOverrides] = useState<Record<string, Mapping>>({});
  const mapping: Mapping = useMemo(() => (current ? (overrides[current.d.id] ?? current.mapping) : {}), [current, overrides]);
  const setField = (f: (typeof FIELDS)[number], col: string) =>
    current && setOverrides((o) => ({ ...o, [current.d.id]: { ...mapping, [f]: col || undefined } }));

  const [teacherInput, setTeacherInput] = useState("");
  const [roomFromClass, setRoomFromClass] = useState(true);
  const [defaultRoom, setDefaultRoom] = useState("");
  const [bellsText, setBellsText] = useState(DEFAULT_BELLS);
  const [onlyMine, setOnlyMine] = useState(true);
  const [startDate, setStartDate] = useState(() => startOfWeek(today()));
  const [weeks, setWeeks] = useState(18);

  const built = useMemo(() => {
    if (!current) return { items: [], errors: [] };
    const res = buildItems(current.d.rows, mapping, {
      bells: parseBells(bellsText),
      defaultTeacher: isAdmin ? teacherInput : ownName,
      roomFromClass,
      defaultRoom,
    });
    if (isAdmin) return res;
    // Giáo viên tự nhập: chỉ lấy tiết của mình (nếu dữ liệu có cột giáo viên), và luôn đứng tên mình
    const mine = onlyMine && mapping.teacher ? res.items.filter((i) => norm(i.teacher) === norm(ownName)) : res.items;
    return { ...res, items: mine.map((i) => ({ ...i, teacher: ownName })) };
  }, [current, mapping, bellsText, isAdmin, teacherInput, ownName, roomFromClass, defaultRoom, onlyMine]);

  const request: ImportRequest = useMemo(() => ({ items: built.items, start_date: startDate, weeks }), [built.items, startDate, weeks]);
  const [check, setCheck] = useState<{ req: ImportRequest; result: ImportResult } | null>(null);
  const checked = check && check.req === request ? check.result : null;
  const [done, setDone] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(dryRun: boolean) {
    setBusy(true);
    setError(null);
    try {
      const result = await api.import({ ...request, dry_run: dryRun });
      if (dryRun) setCheck({ req: request, result });
      else {
        setDone(result);
        setCheck(null);
        // Dữ liệu trong localStorage đã nhập rồi thì trang Lịch không hỏi lại nữa
        if (current && localSets.includes(current.d)) markImported(current.d);
        window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSourceError(null);
    if (/\.xlsx?$/i.test(file.name)) {
      return setSourceError("File Excel (.xlsx) chưa đọc trực tiếp được – trong Excel chọn Tệp → Lưu thành → CSV UTF-8 rồi chọn lại file .csv.");
    }
    addSets(parseFileText(file.name, await file.text()), file.name);
  }

  function addSets(sets: Dataset[], name: string) {
    if (!sets.length) return setSourceError(`Không tìm thấy bảng dữ liệu nào trong “${name}”.`);
    setFileSets((prev) => [...sets, ...prev.filter((p) => !sets.some((s) => s.id === p.id))]);
    setPickedId(sets.find((s) => timetableScore(s).ok)?.id ?? sets[0].id);
    setDone(null);
  }

  const teacherCount = new Set(built.items.map((i) => i.teacher)).size;
  const sessionEstimate = built.items.reduce((n, i) => n + (i.date ? 1 : weeks), 0);
  const host = typeof window === "undefined" ? "" : location.origin;

  return (
    <>
      <PageHeader
        title="Nhập thời khoá biểu"
        subtitle={`Từ app GVCN / GVBM, file CSV (Excel) hoặc JSON – ${isAdmin ? "tạo luôn giáo viên và phòng còn thiếu" : "nhập các tiết dạy của bạn"}.`}
      />

      {done ? (
        <GlassCard className="mb-4 flex flex-col gap-3 p-5" data-testid="import-done">
          <h2 className="text-lg font-semibold">✓ Đã nhập xong</h2>
          <ImportSummary result={done} />
          <div className="flex flex-wrap gap-2">
            <Link href="/">
              <Button variant="primary">Xem lịch</Button>
            </Link>
            <Button onClick={() => setDone(null)}>Nhập thêm</Button>
          </div>
        </GlassCard>
      ) : null}

      {/* ---- 1. Nguồn ---- */}
      <GlassCard className="mb-4 flex flex-col gap-3 p-5">
        <h2 className="text-lg font-semibold">1. Nguồn dữ liệu</h2>
        {waitingBridge && !bridged && <Alert tone="info">Đang chờ dữ liệu từ app bên kia…</Alert>}
        {bridged && (
          <Alert tone="info">
            Đã nhận dữ liệu từ <b>{bridged.title || new URL(bridged.origin).host}</b> ({bridged.origin}): {Object.keys(bridged.entries).length} mục lưu trữ,{" "}
            {bridgedSets.length} bảng. Dữ liệu chỉ nằm trên trình duyệt này cho đến khi bạn bấm Import.
          </Alert>
        )}
        <p className="text-sm text-white/70">
          Bộ nhớ trình duyệt (localStorage) của trang này: {localSets.length ? `tìm thấy ${localSets.length} bảng.` : "không có dữ liệu phù hợp."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer">
            <input type="file" accept=".json,.csv,.txt,.tsv,.xlsx,.xls" className="hidden" onChange={onFile} data-testid="import-file" />
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm hover:bg-white/15">
              📄 Chọn file CSV / JSON
            </span>
          </label>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-white/80">Dán dữ liệu (JSON hoặc bảng copy từ Excel)</summary>
          <div className="mt-2 flex flex-col gap-2">
            <Textarea rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder='[{"thu": "Thứ 2", "tiet": 1, "mon": "Toán", "lop": "10A1"}]' />
            <div>
              <Button onClick={() => addSets(parseFileText("Dữ liệu dán", paste), "dữ liệu dán")} disabled={!paste.trim()}>
                Đọc dữ liệu
              </Button>
            </div>
          </div>
        </details>
        <details className="text-sm" open={!localSets.length && !bridged && !fileSets.length}>
          <summary className="cursor-pointer text-white/80">Lấy dữ liệu từ app GVCN / GVBM ở trang web khác</summary>
          <div className="mt-2 space-y-2 text-white/75">
            <p>
              Mỗi trang web có bộ nhớ riêng nên trang lịch không tự đọc được dữ liệu của app kia. Dùng nút cầu nối dưới đây (chỉ cần làm một lần):
            </p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Kéo nút{" "}
                <a
                  ref={(el) => el?.setAttribute("href", bookmarklet(host))}
                  onClick={(e) => e.preventDefault()}
                  className="inline-block rounded-lg border border-cyan-300/50 bg-cyan-400/20 px-2 py-0.5 font-medium text-white"
                  data-testid="bookmarklet"
                >
                  📥 Gửi sang Lịch
                </a>{" "}
                lên thanh dấu trang (bookmark) của trình duyệt.
              </li>
              <li>Mở app GVCN / GVBM, đăng nhập và mở trang thời khoá biểu như bình thường.</li>
              <li>
                Bấm dấu trang <b>📥 Gửi sang Lịch</b>: trang này mở ra với dữ liệu của app kia, bạn xem trước rồi mới quyết định import.
              </li>
            </ol>
            <p className="text-xs text-white/50">
              Điện thoại khó kéo dấu trang: hãy dùng máy tính, hoặc xuất file CSV / JSON từ app kia rồi chọn file ở trên.
            </p>
          </div>
        </details>
        {sourceError && <Alert>{sourceError}</Alert>}
      </GlassCard>

      {current && (
        <>
          {/* ---- 2. Bảng & cột ---- */}
          <GlassCard className="mb-4 flex flex-col gap-4 p-5">
            <h2 className="text-lg font-semibold">2. Chọn bảng và ghép cột</h2>
            {scored.length > 1 && (
              <Field label="Bảng dữ liệu">
                <Select value={current.d.id} onChange={(e) => setPickedId(e.target.value)} data-testid="dataset">
                  {scored.map(({ d, ok }) => (
                    <option key={d.id} value={d.id}>
                      {ok ? "📅 " : ""}
                      {d.label} – {d.rows.length} dòng
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {!current.ok && (
              <Alert tone="info">Bảng này chưa giống thời khoá biểu (cần cột thứ/ngày, tiết hoặc giờ, và môn hoặc lớp). Hãy ghép cột bên dưới.</Alert>
            )}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {FIELDS.map((f) => (
                <Field key={f} label={FIELD_LABELS[f]}>
                  <Select value={mapping[f] ?? ""} onChange={(e) => setField(f, e.target.value)} data-field={f}>
                    <option value="">— không có —</option>
                    {current.d.columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {isAdmin ? (
                <Field label={mapping.teacher ? "Giáo viên khi ô trống" : `${terms.person} của thời khoá biểu này`}>
                  <Input list="import-teachers" value={teacherInput} onChange={(e) => setTeacherInput(e.target.value)} placeholder="vd. Nguyễn Thu Hà" data-testid="default-teacher" />
                  <datalist id="import-teachers">
                    {teachers.map((t) => (
                      <option key={t.id} value={t.name} />
                    ))}
                  </datalist>
                </Field>
              ) : (
                <div className="text-sm text-white/75">
                  Lịch được nhập dưới tên của bạn: <b>{ownName}</b>
                  {mapping.teacher && (
                    <label className="mt-2 flex items-center gap-2">
                      <input type="checkbox" className="accent-cyan-400" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
                      Chỉ nhập các tiết có tên giáo viên là “{ownName}”
                    </label>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="accent-cyan-400" checked={roomFromClass} onChange={(e) => setRoomFromClass(e.target.checked)} />
                  Không có phòng: dùng tên lớp làm phòng học
                </label>
                <Input value={defaultRoom} onChange={(e) => setDefaultRoom(e.target.value)} placeholder="Phòng mặc định khi không có lớp / phòng" />
              </div>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-white/80">Giờ các tiết (dùng khi dữ liệu chỉ có số tiết)</summary>
              <p className="mt-2 text-xs text-white/55">Mỗi dòng: số tiết rồi giờ. Tiết 1–5 có cột buổi “Chiều” được hiểu là tiết 6–10.</p>
              <Textarea className="mt-2 font-mono" rows={10} value={bellsText} onChange={(e) => setBellsText(e.target.value)} />
            </details>
          </GlassCard>

          {/* ---- 3. Xem trước ---- */}
          <GlassCard className="mb-4 flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg font-semibold">3. Xem trước</h2>
              <div className="flex flex-wrap gap-3">
                <Field label="Áp dụng từ tuần (Thứ 2)">
                  <Input type="date" value={startDate} onChange={(e) => e.target.value && setStartDate(startOfWeek(e.target.value))} />
                </Field>
                <Field label="Số tuần lặp">
                  <Input
                    type="number"
                    min={1}
                    max={MAX_REPEAT_WEEKS}
                    value={weeks}
                    onChange={(e) => setWeeks(Math.min(MAX_REPEAT_WEEKS, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-28"
                  />
                </Field>
              </div>
            </div>
            <p className="text-sm text-white/75" data-testid="preview-summary">
              {built.items.length} tiết / tuần · {teacherCount} giáo viên · khoảng {sessionEstimate} buổi từ {formatFull(startDate)}
              {built.errors.length ? ` · ${built.errors.length} dòng không đọc được` : ""}
            </p>
            {built.errors.length > 0 && (
              <details className="text-sm text-amber-200">
                <summary className="cursor-pointer">Dòng không đọc được</summary>
                <ul className="mt-1 list-disc pl-5">
                  {built.errors.slice(0, 15).map((e) => (
                    <li key={e.row}>
                      Dòng {e.row}: {e.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {built.items.length > 0 && (
              <div className="max-h-96 overflow-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-900/90 text-xs uppercase text-white/60">
                    <tr>
                      {["Thứ / ngày", "Giờ", "Môn / tiêu đề", "Lớp", "Phòng", "Giáo viên", "Loại"].map((h) => (
                        <th key={h} className="px-3 py-2 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {built.items.slice(0, PREVIEW_ROWS).map((i, n) => (
                      <tr key={n} className="border-t border-white/5">
                        <td className="px-3 py-1.5">{i.date ? formatFull(i.date) : DAY_LABELS[i.weekday ?? 0]}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">
                          {i.start_time}–{i.end_time}
                        </td>
                        <td className="px-3 py-1.5">{i.title}</td>
                        <td className="px-3 py-1.5">{i.class_name}</td>
                        <td className="px-3 py-1.5">{i.room}</td>
                        <td className="px-3 py-1.5">{i.teacher}</td>
                        <td className="px-3 py-1.5">{i.kind ? `${KIND_META[i.kind].icon} ${KIND_META[i.kind].label}` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {built.items.length > PREVIEW_ROWS && <p className="px-3 py-2 text-xs text-white/50">… và {built.items.length - PREVIEW_ROWS} tiết nữa</p>}
              </div>
            )}

            {error && <Alert>{error}</Alert>}
            {checked && (
              <div className={cn("rounded-xl border p-3", checked.skipped_count ? "border-amber-300/30 bg-amber-400/10" : "border-emerald-300/30 bg-emerald-400/10")} data-testid="check-result">
                <ImportSummary result={checked} />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => run(true)} disabled={busy || !built.items.length} data-testid="import-check">
                {busy && !checked ? "Đang kiểm tra…" : "Kiểm tra trùng lịch"}
              </Button>
              <Button
                variant="primary"
                onClick={() => run(false)}
                disabled={busy || !checked || !checked.sessions_created}
                title={checked ? undefined : "Bấm Kiểm tra trước để xem sẽ tạo những gì"}
                data-testid="import-run"
              >
                {checked ? `Import ${checked.sessions_created} buổi vào hệ thống` : "Import vào hệ thống"}
              </Button>
              {!checked && built.items.length > 0 && <span className="text-xs text-white/50">Kiểm tra trước, sau đó mới import.</span>}
            </div>
          </GlassCard>
        </>
      )}
    </>
  );
}

function ImportSummary({ result }: { result: ImportResult }) {
  const verb = result.dry_run ? "Sẽ tạo" : "Đã tạo";
  return (
    <div className="space-y-2 text-sm">
      <p>
        {verb} <b>{result.sessions_created}</b> buổi
        {result.teachers_created.length > 0 && (
          <>
            , <b>{result.teachers_created.length}</b> giáo viên mới ({result.teachers_created.slice(0, 8).join(", ")}
            {result.teachers_created.length > 8 ? "…" : ""})
          </>
        )}
        {result.rooms_created.length > 0 && (
          <>
            , <b>{result.rooms_created.length}</b> phòng mới ({result.rooms_created.slice(0, 8).join(", ")}
            {result.rooms_created.length > 8 ? "…" : ""})
          </>
        )}
        .
      </p>
      {result.skipped_count > 0 && (
        <details>
          <summary className="cursor-pointer text-amber-200">
            {result.dry_run ? "Bỏ qua" : "Đã bỏ qua"} {result.skipped_count} buổi trùng lịch / thiếu phòng
          </summary>
          <ul className="mt-1 list-disc pl-5 text-white/70">
            {result.skipped.slice(0, 20).map((s, i) => (
              <li key={i}>
                {formatFull(s.date)} {s.start_time}–{s.end_time} “{s.title}” ({s.teacher}): {s.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
