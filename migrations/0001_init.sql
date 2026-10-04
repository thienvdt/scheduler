-- Giảng viên
CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department TEXT,
  color TEXT NOT NULL DEFAULT '#60a5fa',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Phòng học
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  building TEXT,
  capacity INTEGER,
  equipment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Buổi giảng (date: YYYY-MM-DD, time: HH:MM)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  series_id TEXT,
  title TEXT NOT NULL,
  class_name TEXT,
  teacher_id TEXT NOT NULL REFERENCES teachers(id),
  room_id TEXT NOT NULL REFERENCES rooms(id),
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
CREATE INDEX IF NOT EXISTS idx_sessions_teacher_date ON sessions(teacher_id, date);
CREATE INDEX IF NOT EXISTS idx_sessions_room_date ON sessions(room_id, date);
CREATE INDEX IF NOT EXISTS idx_sessions_series ON sessions(series_id);
