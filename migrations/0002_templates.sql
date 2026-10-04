-- Loại lịch: lecture | practice | meeting | seminar | exam | defense | office_hours | other
ALTER TABLE sessions ADD COLUMN kind TEXT NOT NULL DEFAULT 'lecture';
CREATE INDEX IF NOT EXISTS idx_sessions_kind_date ON sessions(kind, date);

-- Mẫu lịch: người dùng chọn để điền sẵn form đặt lịch
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'meeting',
  icon TEXT,
  title TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  start_time TEXT,
  repeat_weeks INTEGER NOT NULL DEFAULT 1,
  teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO templates (id, name, kind, icon, title, duration_minutes, start_time, repeat_weeks, note, sort_order) VALUES
  ('tpl-lecture', 'Buổi giảng lý thuyết', 'lecture', '📚', NULL, 120, '07:00', 15, NULL, 10),
  ('tpl-practice', 'Thực hành / Lab', 'practice', '🧪', NULL, 180, '13:00', 15, 'Chuẩn bị: máy tính, tài liệu thực hành', 20),
  ('tpl-dept-meeting', 'Họp bộ môn', 'meeting', '👥', 'Họp bộ môn', 90, '14:00', 1,
   'Nội dung:
1. Báo cáo tiến độ giảng dạy
2. Kế hoạch chuyên môn tháng tới
3. Ý kiến khác', 30),
  ('tpl-faculty-meeting', 'Họp khoa', 'meeting', '🏛️', 'Họp khoa', 120, '08:00', 1,
   'Thành phần: toàn thể cán bộ, giảng viên
Nội dung:
1. Thông báo của Ban chủ nhiệm khoa
2. Tổng kết công tác
3. Thảo luận', 40),
  ('tpl-seminar', 'Seminar khoa học', 'seminar', '🎤', 'Seminar khoa học', 90, '15:00', 1,
   'Báo cáo viên:
Chủ đề:
Thời gian trình bày 45 phút, thảo luận 30 phút', 50),
  ('tpl-exam', 'Coi thi', 'exam', '📝', 'Coi thi', 90, '07:30', 1,
   'Có mặt trước giờ thi 15 phút. Mang theo thẻ cán bộ.', 60),
  ('tpl-defense', 'Bảo vệ luận văn / đồ án', 'defense', '🎓', 'Bảo vệ đồ án tốt nghiệp', 180, '08:00', 1,
   'Hội đồng:
- Chủ tịch:
- Thư ký:
- Phản biện:
Danh sách sinh viên:', 70),
  ('tpl-office-hours', 'Tiếp sinh viên', 'office_hours', '💬', 'Giờ tiếp sinh viên', 60, '16:00', 15, NULL, 80);
