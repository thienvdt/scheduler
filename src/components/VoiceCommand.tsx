"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Room, Teacher } from "@/shared/types";
import { formatFull, today } from "@/lib/date";
import { parseVoiceCommand, type ParsedCommand } from "@/lib/voiceParser";
import { Alert, Button, cn, Modal, Textarea } from "./ui";

// Kiểu tối thiểu cho Web Speech API (chưa có trong lib DOM của TypeScript)
interface SpeechRecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

interface SpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionCtor = new () => SpeechRecognition;

function getRecognitionCtor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const noopSubscribe = () => () => {};

const ERRORS: Record<string, string> = {
  "not-allowed": "Chưa cấp quyền dùng micro. Hãy cho phép micro trong cài đặt trình duyệt.",
  "service-not-allowed": "Trình duyệt không cho phép nhận dạng giọng nói trên trang này.",
  "no-speech": "Không nghe thấy giọng nói, hãy thử lại.",
  "audio-capture": "Không tìm thấy micro.",
  network: "Lỗi mạng: nhận dạng giọng nói cần kết nối Internet.",
  "language-not-supported": "Trình duyệt chưa hỗ trợ nhận dạng tiếng Việt.",
};

const EXAMPLE = "Thứ 3 tuần sau thầy An dạy Lập trình Web lớp K66A phòng A101 từ 7 giờ đến 9 giờ, lặp 10 tuần";

export function VoiceCommand({
  teachers,
  rooms,
  onClose,
  onSubmit,
}: {
  teachers: Teacher[];
  rooms: Room[];
  onClose: () => void;
  onSubmit: (parsed: ParsedCommand, transcript: string) => void;
}) {
  const supported = useSyncExternalStore(noopSubscribe, () => getRecognitionCtor() !== undefined, () => true);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const parsed = useMemo(() => parseVoiceCommand(text, { teachers, rooms, today: today() }), [text, teachers, rooms]);

  function start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const base = text.trim();
    const rec = new Ctor();
    rec.lang = "vi-VN";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let spoken = "";
      for (let i = 0; i < e.results.length; i++) spoken += e.results[i][0].transcript;
      setText([base, spoken.trim()].filter(Boolean).join(" "));
    };
    rec.onerror = (e) => {
      if (e.error !== "aborted") setError(ERRORS[e.error] ?? `Lỗi nhận dạng giọng nói (${e.error})`);
    };
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = rec;
    setError(null);
    setListening(true);
    rec.start();
  }

  function stop() {
    recognitionRef.current?.stop();
  }

  function submit() {
    stop();
    onSubmit(parsed, text.trim());
  }

  const teacher = teachers.find((t) => t.id === parsed.teacher_id);
  const room = rooms.find((r) => r.id === parsed.room_id);
  const fields: [string, string | undefined][] = [
    ["Môn", parsed.title],
    ["Lớp", parsed.class_name],
    ["Giảng viên", teacher?.name],
    ["Phòng", room?.name],
    ["Ngày", parsed.date && formatFull(parsed.date)],
    ["Giờ", parsed.start_time && `${parsed.start_time}–${parsed.end_time}`],
    ["Lặp", parsed.repeat_weeks && parsed.repeat_weeks > 1 ? `${parsed.repeat_weeks} tuần` : undefined],
  ];

  return (
    <Modal open title="Đặt lịch bằng giọng nói" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 py-2">
          <button
            type="button"
            onClick={listening ? stop : start}
            disabled={!supported}
            aria-label={listening ? "Dừng ghi âm" : "Bắt đầu nói"}
            className={cn(
              "relative grid h-20 w-20 place-items-center rounded-full border text-3xl backdrop-blur-xl transition",
              "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-40",
              listening
                ? "border-rose-200/60 bg-gradient-to-br from-rose-500/70 to-fuchsia-500/70 shadow-lg shadow-rose-900/50"
                : "border-white/30 bg-gradient-to-br from-indigo-500/60 to-cyan-500/60 shadow-lg shadow-cyan-900/40 hover:scale-105",
            )}
          >
            {listening && <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/30" />}
            <span className="relative">{listening ? "■" : "🎤"}</span>
          </button>
          <p className="text-sm text-white/70">
            {!supported
              ? "Trình duyệt này chưa hỗ trợ nhận dạng giọng nói — hãy dùng Chrome, Edge hoặc Safari, hoặc gõ câu lệnh bên dưới."
              : listening
                ? "Đang nghe… nhấn ■ khi nói xong"
                : "Nhấn micro và nói lịch cần đặt"}
          </p>
        </div>

        {error && <Alert>{error}</Alert>}

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`VD: ${EXAMPLE}`}
          aria-label="Câu lệnh"
          className="min-h-24"
        />

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {fields.map(([label, value]) => (
            <div
              key={label}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm",
                value ? "border-cyan-300/30 bg-cyan-400/10" : "border-white/10 bg-white/5 text-white/40",
              )}
            >
              <div className="text-[10px] uppercase tracking-wide text-white/50">{label}</div>
              <div className="truncate">{value ?? "—"}</div>
            </div>
          ))}
        </div>

        <p className="text-xs text-white/50">
          Mẹo: nói đủ <b>môn</b>, <b>giảng viên</b>, <b>phòng</b>, <b>thứ/ngày</b> và <b>giờ</b>. Bạn sẽ được xem lại trước khi lưu.
        </p>

        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="button" variant="primary" onClick={submit} disabled={!text.trim()}>
            Tiếp tục →
          </Button>
        </div>
      </div>
    </Modal>
  );
}
