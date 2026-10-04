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
  created_at: string;
  teacher_name?: string;
  teacher_color?: string;
  room_name?: string;
}

export type TeacherInput = Pick<Teacher, "name"> &
  Partial<Pick<Teacher, "email" | "phone" | "department" | "color">>;

export type RoomInput = Pick<Room, "name"> &
  Partial<Pick<Room, "building" | "capacity" | "equipment">>;

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
  /** Chỉ dùng khi tạo mới: lặp lại hằng tuần trong N tuần (1 = không lặp). */
  repeat_weeks?: number;
}

export interface Conflict {
  date: string;
  kind: "teacher" | "room";
  session: Session;
}

export interface ApiError {
  error: string;
  conflicts?: Conflict[];
}

export const MAX_REPEAT_WEEKS = 30;
