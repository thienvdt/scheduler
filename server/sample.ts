// Dữ liệu mẫu theo loại hình: người, phòng, lịch trong tuần hiện tại (giờ Việt Nam).
// Mọi bản ghi có id bắt đầu bằng "mau-" để xoá sạch được bằng một nút.

import type { EventKind, ProfileId, User } from "../src/shared/types";
import { HttpError, json, readBody, type Env } from "./http";
import { requireAdmin } from "./auth";
import { getSettings } from "./settings";
import { addDays } from "./time";

interface SamplePerson { id: string; name: string; dept: string; color: string; email?: string }
interface SampleRoom { id: string; name: string; building?: string; capacity?: number; equipment?: string }
interface SampleSession {
  title: string;
  kind: EventKind;
  host: string;
  room: string;
  /** 0 = Thứ 2 … 6 = Chủ nhật */
  day: number;
  start: string;
  end: string;
  group?: string;
  note?: string;
  participants?: string[];
  /** Số tuần lặp (mặc định 1) */
  weeks?: number;
}
interface Sample { people: SamplePerson[]; rooms: SampleRoom[]; sessions: SampleSession[] }

const SAMPLES: Record<ProfileId, Sample> = {
  education: {
    people: [
      { id: "mau-khai", name: "Ngô Đình Khải", dept: "Ban Giám hiệu", color: "#f87171" },
      { id: "mau-ha", name: "Nguyễn Thu Hà", dept: "Tổ Toán", color: "#f472b6" },
      { id: "mau-duc", name: "Trần Minh Đức", dept: "Tổ Toán", color: "#fb7185" },
      { id: "mau-lan", name: "Lê Thị Lan", dept: "Tổ Ngữ văn", color: "#fbbf24" },
      { id: "mau-huy", name: "Phạm Quốc Huy", dept: "Tổ Ngoại ngữ", color: "#a78bfa" },
      { id: "mau-nam", name: "Vũ Hoàng Nam", dept: "Tổ Tin học", color: "#38bdf8" },
      { id: "mau-huong", name: "Bùi Thanh Hương", dept: "Tổ Vật lý", color: "#34d399" },
    ],
    rooms: [
      { id: "mau-a101", name: "A101", building: "Nhà A", capacity: 45, equipment: "Máy chiếu, loa" },
      { id: "mau-a102", name: "A102", building: "Nhà A", capacity: 45, equipment: "Máy chiếu" },
      { id: "mau-a201", name: "A201", building: "Nhà A", capacity: 40, equipment: "Bảng tương tác" },
      { id: "mau-lab", name: "Lab Tin học", building: "Nhà B", capacity: 32, equipment: "32 máy tính" },
      { id: "mau-hoitruong", name: "Hội trường", building: "Nhà C", capacity: 150, equipment: "Âm thanh, máy chiếu" },
    ],
    sessions: [
      { title: "Toán", kind: "lecture", host: "mau-ha", room: "mau-a101", day: 0, start: "07:00", end: "08:30", group: "10A1", weeks: 4 },
      { title: "Ngữ văn", kind: "lecture", host: "mau-lan", room: "mau-a101", day: 0, start: "08:45", end: "10:15", group: "10A1", weeks: 4 },
      { title: "Tiếng Anh", kind: "lecture", host: "mau-huy", room: "mau-a102", day: 1, start: "07:00", end: "08:30", group: "11A1", weeks: 4 },
      { title: "Tin học", kind: "practice", host: "mau-nam", room: "mau-lab", day: 2, start: "09:00", end: "11:00", group: "10A2", weeks: 4 },
      { title: "Vật lý", kind: "lecture", host: "mau-huong", room: "mau-a201", day: 3, start: "07:00", end: "08:30", group: "11A2", weeks: 4 },
      { title: "Toán", kind: "lecture", host: "mau-duc", room: "mau-a102", day: 4, start: "07:00", end: "08:30", group: "11A1", weeks: 4 },
      { title: "Tiếng Anh giao tiếp Online", kind: "lecture", host: "mau-huy", room: "r-online", day: 3, start: "19:30", end: "21:00", group: "Lớp buổi tối", weeks: 4 },
      { title: "Họp tổ Toán – Tin", kind: "meeting", host: "mau-ha", room: "mau-a201", day: 2, start: "14:00", end: "15:30", participants: ["mau-duc", "mau-nam"],
        note: "Nội dung:\n1. Tiến độ chương trình\n2. Đề kiểm tra giữa kỳ" },
      { title: "Họp Hội đồng sư phạm", kind: "meeting", host: "mau-khai", room: "mau-hoitruong", day: 4, start: "15:30", end: "17:00",
        participants: ["mau-ha", "mau-duc", "mau-lan", "mau-huy", "mau-nam", "mau-huong"] },
      { title: "Coi thi giữa kỳ", kind: "exam", host: "mau-duc", room: "mau-a101", day: 5, start: "07:30", end: "09:00", group: "11A2" },
      { title: "Tiếp sinh viên / phụ huynh", kind: "office_hours", host: "mau-lan", room: "mau-a201", day: 1, start: "16:00", end: "17:00", weeks: 4 },
    ],
  },
  business: {
    people: [
      { id: "mau-long", name: "Nguyễn Hoàng Long", dept: "Ban Giám đốc", color: "#fbbf24" },
      { id: "mau-trang", name: "Trần Thu Trang", dept: "Kinh doanh", color: "#f472b6" },
      { id: "mau-quan", name: "Lê Minh Quân", dept: "Kinh doanh", color: "#fb7185" },
      { id: "mau-anh", name: "Phạm Ngọc Ánh", dept: "Kinh doanh", color: "#e879f9" },
      { id: "mau-tam", name: "Bùi Thanh Tâm", dept: "Kế toán", color: "#34d399" },
      { id: "mau-maianh", name: "Hoàng Mai Anh", dept: "Nhân sự", color: "#a78bfa" },
      { id: "mau-thang", name: "Vũ Đức Thắng", dept: "IT", color: "#38bdf8" },
      { id: "mau-hainam", name: "Lý Hải Nam", dept: "IT", color: "#22d3ee" },
    ],
    rooms: [
      { id: "mau-ph1", name: "Phòng họp 1", building: "Tầng 5", capacity: 8, equipment: "TV, camera họp online" },
      { id: "mau-ph2", name: "Phòng họp 2", building: "Tầng 5", capacity: 6, equipment: "Bảng trắng" },
      { id: "mau-hoitruong", name: "Hội trường", building: "Tầng 5", capacity: 30, equipment: "Máy chiếu, âm thanh" },
    ],
    sessions: [
      { title: "Họp giao ban tuần", kind: "meeting", host: "mau-long", room: "mau-hoitruong", day: 0, start: "08:30", end: "09:30", weeks: 4,
        participants: ["mau-trang", "mau-tam", "mau-maianh", "mau-thang"], note: "1. Kết quả tuần trước\n2. Kế hoạch tuần này\n3. Vướng mắc" },
      { title: "Demo CRM cho khách hàng", kind: "client", host: "mau-trang", room: "mau-ph1", day: 1, start: "10:00", end: "11:30", group: "Công ty XYZ",
        participants: ["mau-quan", "mau-hainam"] },
      { title: "Phỏng vấn Lập trình viên", kind: "interview", host: "mau-maianh", room: "mau-ph2", day: 2, start: "09:00", end: "10:00", participants: ["mau-thang"],
        note: "Ứng viên: Nguyễn Văn Tú\nVòng: kỹ thuật" },
      { title: "Đào tạo nội bộ: dùng CRM mới", kind: "training", host: "mau-thang", room: "mau-hoitruong", day: 3, start: "14:00", end: "15:30",
        participants: ["mau-trang", "mau-quan", "mau-anh", "mau-hainam"] },
      { title: "Công tác Bình Dương – khảo sát kho", kind: "business_trip", host: "mau-quan", room: "r-outside", day: 3, start: "08:00", end: "12:00" },
      { title: "Họp online với đối tác Singapore", kind: "meeting", host: "mau-tam", room: "r-online", day: 4, start: "10:00", end: "11:00", participants: ["mau-long"] },
      { title: "Họp 1:1", kind: "one_on_one", host: "mau-long", room: "mau-ph2", day: 4, start: "16:00", end: "16:30", participants: ["mau-trang"], weeks: 4 },
      { title: "Gặp khách hàng Công ty ABC", kind: "client", host: "mau-anh", room: "mau-ph1", day: 2, start: "14:00", end: "15:00", group: "Công ty ABC" },
    ],
  },
  office: {
    people: [
      { id: "mau-hung", name: "Nguyễn Văn Hùng", dept: "Lãnh đạo Văn phòng", color: "#fbbf24" },
      { id: "mau-mai", name: "Trần Thị Mai", dept: "Lãnh đạo Văn phòng", color: "#f59e0b" },
      { id: "mau-bao", name: "Lê Quốc Bảo", dept: "Phòng Tổng hợp", color: "#38bdf8" },
      { id: "mau-thutrang", name: "Phạm Thu Trang", dept: "Phòng Hành chính", color: "#f472b6" },
      { id: "mau-khang", name: "Đỗ Minh Khang", dept: "Phòng Tài vụ", color: "#34d399" },
      { id: "mau-hanh", name: "Vũ Thị Hạnh", dept: "Bộ phận Một cửa", color: "#a78bfa" },
    ],
    rooms: [
      { id: "mau-phop", name: "Phòng họp tầng 2", building: "Trụ sở", capacity: 20, equipment: "Màn hình, micro" },
      { id: "mau-hoitruong", name: "Hội trường lớn", building: "Trụ sở", capacity: 150, equipment: "Sân khấu, âm thanh" },
      { id: "mau-tiepdan", name: "Phòng tiếp công dân", building: "Tầng 1", capacity: 6 },
    ],
    sessions: [
      { title: "Giao ban đầu tuần", kind: "meeting", host: "mau-hung", room: "mau-phop", day: 0, start: "07:30", end: "08:30", weeks: 4,
        participants: ["mau-mai", "mau-bao", "mau-thutrang", "mau-khang"], note: "1. Kết quả tuần trước\n2. Nhiệm vụ tuần này" },
      { title: "Tiếp công dân", kind: "reception", host: "mau-hanh", room: "mau-tiepdan", day: 1, start: "08:00", end: "11:00", weeks: 4 },
      { title: "Tiếp công dân", kind: "reception", host: "mau-mai", room: "mau-tiepdan", day: 3, start: "08:00", end: "11:00", weeks: 4 },
      { title: "Công tác xã Phú Mỹ", kind: "business_trip", host: "mau-bao", room: "r-outside", day: 2, start: "07:30", end: "16:30", group: "UBND xã Phú Mỹ" },
      { title: "Tập huấn phần mềm quản lý văn bản", kind: "training", host: "mau-khang", room: "mau-phop", day: 3, start: "14:00", end: "16:00",
        participants: ["mau-thutrang", "mau-hanh", "mau-bao"] },
      { title: "Hội nghị tổng kết quý", kind: "conference", host: "mau-hung", room: "mau-hoitruong", day: 4, start: "08:00", end: "11:30",
        participants: ["mau-mai", "mau-bao", "mau-thutrang", "mau-khang", "mau-hanh"] },
      { title: "Trực cơ quan", kind: "duty", host: "mau-thutrang", room: "mau-tiepdan", day: 5, start: "07:30", end: "11:30" },
    ],
  },
};

/** Thứ 2 của tuần hiện tại theo giờ Việt Nam (UTC+7). */
export function mondayVN(now = new Date()): string {
  const vn = new Date(now.getTime() + 7 * 3600_000);
  const offset = (vn.getUTCDay() + 6) % 7;
  return addDays(vn.toISOString().slice(0, 10), -offset);
}

export function sampleFor(profile: ProfileId): Sample {
  return SAMPLES[profile];
}

function loadStatements(env: Env, sample: Sample, monday: string) {
  const stmts: D1PreparedStatement[] = [];
  const person = env.DB.prepare("INSERT OR IGNORE INTO teachers (id, name, email, phone, department, color) VALUES (?, ?, ?, NULL, ?, ?)");
  for (const p of sample.people) stmts.push(person.bind(p.id, p.name, p.email ?? null, p.dept, p.color));
  const room = env.DB.prepare("INSERT OR IGNORE INTO rooms (id, name, building, capacity, equipment) VALUES (?, ?, ?, ?, ?)");
  for (const r of sample.rooms) stmts.push(room.bind(r.id, r.name, r.building ?? null, r.capacity ?? null, r.equipment ?? null));
  const session = env.DB.prepare(
    `INSERT OR IGNORE INTO sessions (id, series_id, title, class_name, teacher_id, room_id, date, start_time, end_time, note, status, kind)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
  );
  const part = env.DB.prepare("INSERT OR IGNORE INTO session_participants (session_id, teacher_id) VALUES (?, ?)");
  sample.sessions.forEach((s, i) => {
    const weeks = s.weeks ?? 1;
    const series = weeks > 1 ? `mau-series-${i}` : null;
    for (let w = 0; w < weeks; w++) {
      const id = `mau-s${i}-w${w}`;
      stmts.push(session.bind(id, series, s.title, s.group ?? null, s.host, s.room, addDays(monday, s.day + w * 7), s.start, s.end, s.note ?? null, s.kind));
      for (const p of s.participants ?? []) stmts.push(part.bind(id, p));
    }
  });
  return stmts;
}

function clearStatements(env: Env) {
  return [
    env.DB.prepare("DELETE FROM session_participants WHERE session_id LIKE 'mau-%' OR teacher_id LIKE 'mau-%'"),
    // Lịch người dùng tự tạo nhưng dùng người/phòng mẫu cũng phải xoá, nếu không sẽ vướng khoá ngoại
    env.DB.prepare("DELETE FROM session_participants WHERE session_id IN (SELECT id FROM sessions WHERE teacher_id LIKE 'mau-%' OR room_id LIKE 'mau-%')"),
    env.DB.prepare("DELETE FROM sessions WHERE id LIKE 'mau-%' OR teacher_id LIKE 'mau-%' OR room_id LIKE 'mau-%'"),
    env.DB.prepare("UPDATE templates SET teacher_id = NULL WHERE teacher_id LIKE 'mau-%'"),
    env.DB.prepare("UPDATE templates SET room_id = NULL WHERE room_id LIKE 'mau-%'"),
    env.DB.prepare("UPDATE users SET teacher_id = NULL WHERE teacher_id LIKE 'mau-%'"),
    env.DB.prepare("DELETE FROM teachers WHERE id LIKE 'mau-%'"),
    env.DB.prepare("DELETE FROM rooms WHERE id LIKE 'mau-%'"),
  ];
}

async function counts(env: Env) {
  const one = async (sql: string) => (await env.DB.prepare(sql).first<{ n: number }>())?.n ?? 0;
  return {
    people: await one("SELECT COUNT(*) AS n FROM teachers WHERE id LIKE 'mau-%'"),
    rooms: await one("SELECT COUNT(*) AS n FROM rooms WHERE id LIKE 'mau-%'"),
    sessions: await one("SELECT COUNT(*) AS n FROM sessions WHERE id LIKE 'mau-%'"),
  };
}

/** GET: số bản ghi mẫu đang có · POST {action: "load" | "clear"} (quản trị viên) */
export async function handleSample(env: Env, request: Request, user: User): Promise<Response> {
  if (request.method === "GET") return json(await counts(env));
  if (request.method !== "POST") throw new HttpError(404, "Không tìm thấy đường dẫn");
  requireAdmin(user);
  const { action } = await readBody(request);
  if (action === "clear") {
    await env.DB.batch(clearStatements(env));
  } else if (action === "load") {
    const { profile } = await getSettings(env);
    // Nạp lại sạch sẽ: xoá mẫu cũ (có thể của loại hình khác) rồi nạp theo tuần hiện tại
    await env.DB.batch([...clearStatements(env), ...loadStatements(env, SAMPLES[profile], mondayVN())]);
  } else {
    throw new HttpError(400, 'action phải là "load" hoặc "clear"');
  }
  return json(await counts(env));
}
