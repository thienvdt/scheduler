-- Cài đặt chung của đơn vị (key/value). profile: education | business | office
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Bản cài đặt đã có dữ liệu trước đây là trường học
INSERT OR IGNORE INTO settings (key, value) VALUES ('profile', 'education'), ('org_name', '');

-- Phòng ảo (Online, Bên ngoài / Công tác): không kiểm tra trùng phòng, chỉ kiểm tra trùng người
ALTER TABLE rooms ADD COLUMN is_virtual INTEGER NOT NULL DEFAULT 0;
INSERT OR IGNORE INTO rooms (id, name, building, capacity, equipment, is_virtual) VALUES
  ('r-online', 'Online', NULL, NULL, 'Google Meet / Zoom / Teams', 1),
  ('r-outside', 'Bên ngoài / Công tác', NULL, NULL, NULL, 1);
