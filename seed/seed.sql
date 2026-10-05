-- Dữ liệu mẫu cho môi trường local
INSERT OR IGNORE INTO teachers (id, name, email, department, color) VALUES
  ('t-an', 'ThS. Nguyễn Văn An', 'an@example.edu.vn', 'Khoa CNTT', '#60a5fa'),
  ('t-binh', 'TS. Trần Thị Bình', 'binh@example.edu.vn', 'Khoa Toán', '#f472b6'),
  ('t-cuong', 'PGS. Lê Minh Cường', 'cuong@example.edu.vn', 'Khoa Ngoại ngữ', '#34d399');

INSERT OR IGNORE INTO rooms (id, name, building, capacity, equipment) VALUES
  ('r-a101', 'A101', 'Nhà A', 60, 'Máy chiếu, loa'),
  ('r-a202', 'A202', 'Nhà A', 40, 'Máy chiếu'),
  ('r-lab1', 'Lab 1', 'Nhà B', 30, '30 máy tính');

-- Tài khoản mẫu CHỈ DÙNG LOCAL: admin / admin12345, an / giangvien123, binh / giangvien123
INSERT OR IGNORE INTO users (id, username, display_name, password_hash, role, teacher_id) VALUES
  ('u-admin', 'admin', 'Quản trị viên', 'pbkdf2$100000$csf/TMSB01Ae48VfUXm5oQ==$PGsohrSNfP/tvLpwWWUn7Jg3GS/r1w+k8Ww0DbS7Qpg=', 'admin', NULL),
  ('u-an', 'an', 'ThS. Nguyễn Văn An', 'pbkdf2$100000$xsOolLikH2bWGx83vxnNHQ==$PijhGKF7bmIW43kDr7Jeiefvsw56jgKbPE51756UMUc=', 'teacher', 't-an'),
  ('u-binh', 'binh', 'TS. Trần Thị Bình', 'pbkdf2$100000$xsOolLikH2bWGx83vxnNHQ==$PijhGKF7bmIW43kDr7Jeiefvsw56jgKbPE51756UMUc=', 'teacher', 't-binh');
