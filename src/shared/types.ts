// Kiểu dữ liệu dùng chung giữa giao diện (src/) và API (server/, functions/).

export interface Teacher {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  color: string;
  created_at: string;
}

export interface Room {
  id: string;
  name: string;
  building: string | null;
  capacity: number | null;
  equipment: string | null;
  /** 1 = phòng ảo (Online, bên ngoài): không kiểm tra trùng phòng */
  is_virtual: number;
  created_at: string;
}

export type SessionStatus = "scheduled" | "cancelled";

export interface Session {
  id: string;
  series_id: string | null;
  title: string;
  class_name: string | null;
  teacher_id: string;
  room_id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  note: string | null;
  status: SessionStatus;
  kind: EventKind;
  created_at: string;
  /** Người tham dự (ngoài người chủ trì teacher_id) */
  participant_ids: string[];
  teacher_name?: string;
  teacher_color?: string;
  room_name?: string;
}

export type TeacherInput = Pick<Teacher, "name"> &
  Partial<Pick<Teacher, "email" | "phone" | "department" | "color">>;

export type RoomInput = Pick<Room, "name"> &
  Partial<Pick<Room, "building" | "capacity" | "equipment">> & { is_virtual?: boolean };

export interface SessionInput {
  title: string;
  class_name?: string | null;
  teacher_id: string;
  room_id: string;
  date: string;
  start_time: string;
  end_time: string;
  note?: string | null;
  status?: SessionStatus;
  kind?: EventKind;
  participant_ids?: string[];
  /** Chỉ dùng khi tạo mới: lặp lại hằng tuần trong N tuần (1 = không lặp). */
  repeat_weeks?: number;
}

export interface Conflict {
  date: string;
  kind: "teacher" | "room";
  session: Session;
  /** Với kind = "teacher": người bị trùng lịch (chủ trì hoặc người tham dự) */
  teacher_id?: string;
  teacher_name?: string;
}

export interface ApiError {
  error: string;
  conflicts?: Conflict[];
}

export const MAX_REPEAT_WEEKS = 30;

export const EVENT_KINDS = [
  "lecture",
  "practice",
  "meeting",
  "seminar",
  "exam",
  "defense",
  "office_hours",
  "client",
  "one_on_one",
  "interview",
  "training",
  "conference",
  "reception",
  "business_trip",
  "duty",
  "other",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const KIND_META: Record<EventKind, { label: string; icon: string }> = {
  lecture: { label: "Giảng dạy", icon: "📚" },
  practice: { label: "Thực hành", icon: "🧪" },
  meeting: { label: "Cuộc họp", icon: "👥" },
  seminar: { label: "Seminar / Hội thảo", icon: "🎤" },
  exam: { label: "Coi thi", icon: "📝" },
  defense: { label: "Bảo vệ", icon: "🎓" },
  office_hours: { label: "Tiếp sinh viên", icon: "💬" },
  client: { label: "Gặp khách hàng", icon: "🤝" },
  one_on_one: { label: "Họp 1:1", icon: "🧑‍💼" },
  interview: { label: "Phỏng vấn", icon: "🎯" },
  training: { label: "Đào tạo / Tập huấn", icon: "📈" },
  conference: { label: "Hội nghị", icon: "🏛️" },
  reception: { label: "Tiếp khách / Tiếp dân", icon: "🙋" },
  business_trip: { label: "Công tác", icon: "🚗" },
  duty: { label: "Trực", icon: "🛡️" },
  other: { label: "Khác", icon: "📌" },
};

export interface Template {
  id: string;
  name: string;
  kind: EventKind;
  icon: string | null;
  title: string | null;
  duration_minutes: number;
  start_time: string | null;
  repeat_weeks: number;
  teacher_id: string | null;
  room_id: string | null;
  note: string | null;
  sort_order: number;
  created_at: string;
}

export type TemplateInput = Omit<Template, "id" | "created_at" | "sort_order"> & { sort_order?: number };

export type Role = "admin" | "teacher";

export const PROFILE_IDS = ["education", "business", "office"] as const;
export type ProfileId = (typeof PROFILE_IDS)[number];

export interface User {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  /** Giảng viên tương ứng (bắt buộc với role teacher để đặt lịch) */
  teacher_id: string | null;
  created_at: string;
}

export interface UserInput {
  username: string;
  display_name: string;
  role: Role;
  teacher_id?: string | null;
  /** Bắt buộc khi tạo; khi sửa: bỏ trống = giữ mật khẩu cũ */
  password?: string;
}

export interface Settings {
  profile: ProfileId;
  /** Tên đơn vị hiển thị trên thanh điều hướng, màn hình đăng nhập */
  org_name: string;
}

export interface AuthState {
  user: User | null;
  settings: Settings;
  /** Chưa có tài khoản nào – cần tạo quản trị viên đầu tiên */
  needs_setup: boolean;
}

export const MIN_PASSWORD_LENGTH = 8;
