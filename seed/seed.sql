-- Dữ liệu mẫu cho môi trường local
INSERT OR IGNORE INTO teachers (id, name, email, department, color) VALUES
  ('t-an', 'ThS. Nguyễn Văn An', 'an@example.edu.vn', 'Khoa CNTT', '#60a5fa'),
  ('t-binh', 'TS. Trần Thị Bình', 'binh@example.edu.vn', 'Khoa Toán', '#f472b6'),
  ('t-cuong', 'PGS. Lê Minh Cường', 'cuong@example.edu.vn', 'Khoa Ngoại ngữ', '#34d399');

INSERT OR IGNORE INTO rooms (id, name, building, capacity, equipment) VALUES
  ('r-a101', 'A101', 'Nhà A', 60, 'Máy chiếu, loa'),
  ('r-a202', 'A202', 'Nhà A', 40, 'Máy chiếu'),
  ('r-lab1', 'Lab 1', 'Nhà B', 30, '30 máy tính');
