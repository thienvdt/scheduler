-- Người tham dự (ngoài người chủ trì sessions.teacher_id)
CREATE TABLE IF NOT EXISTS session_participants (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, teacher_id)
);
CREATE INDEX IF NOT EXISTS idx_participants_teacher ON session_participants(teacher_id);

-- Tài khoản đăng nhập. role: admin | teacher (teacher liên kết với một giảng viên)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'teacher',
  teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Phiên đăng nhập: chỉ lưu SHA-256 của token trong cookie
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);

-- Chống dò mật khẩu: đếm số lần đăng nhập sai theo tên đăng nhập
CREATE TABLE IF NOT EXISTS login_attempts (
  username TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL
);
