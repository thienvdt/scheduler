// Loại hình sử dụng: đổi cách gọi, loại lịch, mẫu lịch mặc định cho phù hợp trường học / doanh nghiệp / văn phòng.
// Dùng chung cho giao diện và API (API dùng danh sách mẫu mặc định).

import type { EventKind, ProfileId, TemplateInput } from "./types";

export type DefaultTemplate = Omit<TemplateInput, "teacher_id" | "room_id"> & { id: string; sort_order: number };

export interface Profile {
  id: ProfileId;
  label: string;
  icon: string;
  description: string;
  /** Tên app khi chưa đặt tên đơn vị */
  appName: string;
  calendarTitle: string;
  /** Người (giảng viên / nhân viên / cán bộ) – số ít và tiêu đề trang */
  person: string;
  people: string;
  department: string;
  room: string;
  /** Trường nhóm (lớp / khách hàng – dự án / đơn vị) gắn với lịch */
  group: string;
  groupPlaceholder: string;
  /** Loại lịch hiển thị trong danh sách chọn (theo thứ tự) */
  kinds: EventKind[];
  defaultKind: EventKind;
  /** Loại lịch "công việc chính" – tách riêng trong thống kê và báo cáo */
  primaryKinds: EventKind[];
  primaryLabel: string;
  primaryHoursLabel: string;
  primaryCountLabel: string;
  otherLabel: string;
  otherHoursLabel: string;
  otherCountLabel: string;
  /** Loại lịch có trường nhóm */
  groupKinds: EventKind[];
  /** Nhãn tiêu đề với loại lịch chính (vd. "Môn học") */
  primaryTitleLabel: string;
  primaryTitlePlaceholder: string;
  titlePlaceholder: string;
  voiceExample: string;
  templates: DefaultTemplate[];
}

const EDUCATION: Profile = {
  id: "education",
  label: "Trường học / Giáo viên",
  icon: "🎓",
  description: "Lịch giảng, thực hành, coi thi, bảo vệ, họp bộ môn, tiếp sinh viên.",
  appName: "Lịch Giảng",
  calendarTitle: "Lịch giảng",
  person: "Giảng viên",
  people: "Giảng viên",
  department: "Khoa / Bộ môn",
  room: "Phòng học",
  group: "Lớp",
  groupPlaceholder: "VD: CNTT-K66A",
  kinds: ["lecture", "practice", "meeting", "seminar", "exam", "defense", "office_hours", "training", "other"],
  defaultKind: "lecture",
  primaryKinds: ["lecture", "practice"],
  primaryLabel: "Buổi giảng",
  primaryHoursLabel: "Giờ giảng",
  primaryCountLabel: "Số buổi giảng",
  otherLabel: "Họp & sự kiện",
  otherHoursLabel: "Giờ họp & sự kiện",
  otherCountLabel: "Số buổi họp & sự kiện",
  groupKinds: ["lecture", "practice", "exam"],
  primaryTitleLabel: "Môn học",
  primaryTitlePlaceholder: "VD: Lập trình Web",
  titlePlaceholder: "VD: Họp bộ môn tháng 10",
  voiceExample: "Thứ 3 tuần sau thầy An dạy Lập trình Web lớp K66A phòng A101 từ 7 giờ đến 9 giờ, lặp 10 tuần",
  templates: [
    { id: "tpl-lecture", name: "Buổi giảng lý thuyết", kind: "lecture", icon: "📚", title: null, duration_minutes: 120, start_time: "07:00", repeat_weeks: 15, note: null, sort_order: 10 },
    { id: "tpl-practice", name: "Thực hành / Lab", kind: "practice", icon: "🧪", title: null, duration_minutes: 180, start_time: "13:00", repeat_weeks: 15, note: "Chuẩn bị: máy tính, tài liệu thực hành", sort_order: 20 },
    { id: "tpl-dept-meeting", name: "Họp bộ môn", kind: "meeting", icon: "👥", title: "Họp bộ môn", duration_minutes: 90, start_time: "14:00", repeat_weeks: 1, note: "Nội dung:\n1. Báo cáo tiến độ giảng dạy\n2. Kế hoạch chuyên môn tháng tới\n3. Ý kiến khác", sort_order: 30 },
    { id: "tpl-faculty-meeting", name: "Họp khoa", kind: "meeting", icon: "🏛️", title: "Họp khoa", duration_minutes: 120, start_time: "08:00", repeat_weeks: 1, note: "Thành phần: toàn thể cán bộ, giảng viên\nNội dung:\n1. Thông báo của Ban chủ nhiệm khoa\n2. Tổng kết công tác\n3. Thảo luận", sort_order: 40 },
    { id: "tpl-seminar", name: "Seminar khoa học", kind: "seminar", icon: "🎤", title: "Seminar khoa học", duration_minutes: 90, start_time: "15:00", repeat_weeks: 1, note: "Báo cáo viên:\nChủ đề:\nThời gian trình bày 45 phút, thảo luận 30 phút", sort_order: 50 },
    { id: "tpl-exam", name: "Coi thi", kind: "exam", icon: "📝", title: "Coi thi", duration_minutes: 90, start_time: "07:30", repeat_weeks: 1, note: "Có mặt trước giờ thi 15 phút. Mang theo thẻ cán bộ.", sort_order: 60 },
    { id: "tpl-defense", name: "Bảo vệ luận văn / đồ án", kind: "defense", icon: "🎓", title: "Bảo vệ đồ án tốt nghiệp", duration_minutes: 180, start_time: "08:00", repeat_weeks: 1, note: "Hội đồng:\n- Chủ tịch:\n- Thư ký:\n- Phản biện:\nDanh sách sinh viên:", sort_order: 70 },
    { id: "tpl-office-hours", name: "Tiếp sinh viên", kind: "office_hours", icon: "💬", title: "Giờ tiếp sinh viên", duration_minutes: 60, start_time: "16:00", repeat_weeks: 15, note: null, sort_order: 80 },
  ],
};

const BUSINESS: Profile = {
  id: "business",
  label: "Doanh nghiệp",
  icon: "🏢",
  description: "Họp nội bộ, gặp khách hàng, họp 1:1, phỏng vấn, đào tạo, công tác.",
  appName: "Lịch Họp",
  calendarTitle: "Lịch làm việc",
  person: "Nhân viên",
  people: "Nhân viên",
  department: "Phòng ban",
  room: "Phòng họp",
  group: "Khách hàng / Dự án",
  groupPlaceholder: "VD: Công ty ABC, Dự án CRM",
  kinds: ["meeting", "client", "one_on_one", "interview", "training", "seminar", "business_trip", "other"],
  defaultKind: "meeting",
  primaryKinds: ["client", "training"],
  primaryLabel: "Khách hàng & đào tạo",
  primaryHoursLabel: "Giờ khách hàng & đào tạo",
  primaryCountLabel: "Số lịch khách hàng & đào tạo",
  otherLabel: "Họp nội bộ & khác",
  otherHoursLabel: "Giờ họp nội bộ & khác",
  otherCountLabel: "Số cuộc họp nội bộ & khác",
  groupKinds: ["client", "meeting", "business_trip", "training"],
  primaryTitleLabel: "Tiêu đề",
  primaryTitlePlaceholder: "VD: Demo sản phẩm cho Công ty ABC",
  titlePlaceholder: "VD: Họp giao ban tuần",
  voiceExample: "Thứ 4 lúc 10 giờ chị Lan gặp khách hàng Công ty ABC phòng họp 1 trong 1 tiếng",
  templates: [
    { id: "tpl-biz-weekly", name: "Họp giao ban tuần", kind: "meeting", icon: "👥", title: "Họp giao ban tuần", duration_minutes: 60, start_time: "08:30", repeat_weeks: 12, note: "Nội dung:\n1. Kết quả tuần trước\n2. Kế hoạch tuần này\n3. Vướng mắc cần hỗ trợ", sort_order: 10 },
    { id: "tpl-biz-client", name: "Gặp khách hàng", kind: "client", icon: "🤝", title: null, duration_minutes: 60, start_time: "10:00", repeat_weeks: 1, note: "Khách hàng:\nNgười liên hệ:\nMục tiêu buổi gặp:\nTài liệu cần chuẩn bị:", sort_order: 20 },
    { id: "tpl-biz-1on1", name: "Họp 1:1", kind: "one_on_one", icon: "🧑‍💼", title: "Họp 1:1", duration_minutes: 30, start_time: "16:00", repeat_weeks: 4, note: "1. Cập nhật công việc\n2. Khó khăn\n3. Mục tiêu phát triển", sort_order: 30 },
    { id: "tpl-biz-interview", name: "Phỏng vấn ứng viên", kind: "interview", icon: "🎯", title: "Phỏng vấn", duration_minutes: 45, start_time: "09:00", repeat_weeks: 1, note: "Ứng viên:\nVị trí:\nVòng:\nNgười phỏng vấn:", sort_order: 40 },
    { id: "tpl-biz-training", name: "Đào tạo nội bộ", kind: "training", icon: "📈", title: "Đào tạo nội bộ", duration_minutes: 120, start_time: "14:00", repeat_weeks: 1, note: "Chủ đề:\nNgười trình bày:\nĐối tượng:", sort_order: 50 },
    { id: "tpl-biz-workshop", name: "Workshop / Brainstorm", kind: "seminar", icon: "🧠", title: "Workshop", duration_minutes: 90, start_time: "15:00", repeat_weeks: 1, note: "Mục tiêu:\nĐầu ra mong muốn:", sort_order: 60 },
    { id: "tpl-biz-monthly", name: "Báo cáo tháng", kind: "meeting", icon: "📊", title: "Họp báo cáo tháng", duration_minutes: 90, start_time: "14:00", repeat_weeks: 1, note: "1. Doanh số / KPI\n2. Chi phí\n3. Kế hoạch tháng tới", sort_order: 70 },
    { id: "tpl-biz-trip", name: "Đi công tác", kind: "business_trip", icon: "🚗", title: "Công tác", duration_minutes: 480, start_time: "08:00", repeat_weeks: 1, note: "Địa điểm:\nPhương tiện:\nMục đích:", sort_order: 80 },
  ],
};

const OFFICE: Profile = {
  id: "office",
  label: "Văn phòng / Hành chính",
  icon: "🏛️",
  description: "Giao ban, hội nghị, tiếp khách – tiếp dân, công tác, trực cơ quan, tập huấn.",
  appName: "Lịch Công Tác",
  calendarTitle: "Lịch công tác",
  person: "Cán bộ",
  people: "Cán bộ",
  department: "Phòng / Ban",
  room: "Phòng",
  group: "Đơn vị / Đối tác",
  groupPlaceholder: "VD: Sở Nội vụ, UBND phường",
  kinds: ["meeting", "conference", "reception", "business_trip", "duty", "training", "interview", "other"],
  defaultKind: "meeting",
  primaryKinds: ["reception", "business_trip", "duty"],
  primaryLabel: "Tiếp khách, công tác & trực",
  primaryHoursLabel: "Giờ tiếp khách, công tác & trực",
  primaryCountLabel: "Số lịch tiếp khách, công tác & trực",
  otherLabel: "Họp & hội nghị",
  otherHoursLabel: "Giờ họp & hội nghị",
  otherCountLabel: "Số cuộc họp & hội nghị",
  groupKinds: ["reception", "business_trip", "conference", "meeting"],
  primaryTitleLabel: "Nội dung",
  primaryTitlePlaceholder: "VD: Tiếp đoàn kiểm tra của Sở",
  titlePlaceholder: "VD: Giao ban đầu tuần",
  voiceExample: "Sáng thứ 2 lúc 7 giờ 30 giao ban toàn cơ quan tại hội trường trong 1 tiếng, lặp 12 tuần",
  templates: [
    { id: "tpl-off-briefing", name: "Giao ban đầu tuần", kind: "meeting", icon: "🏛️", title: "Giao ban đầu tuần", duration_minutes: 60, start_time: "07:30", repeat_weeks: 12, note: "Thành phần: lãnh đạo, trưởng các phòng\n1. Kết quả tuần trước\n2. Nhiệm vụ tuần này", sort_order: 10 },
    { id: "tpl-off-topic", name: "Họp chuyên đề", kind: "meeting", icon: "🗂️", title: "Họp chuyên đề", duration_minutes: 120, start_time: "14:00", repeat_weeks: 1, note: "Chủ trì:\nThành phần:\nNội dung:", sort_order: 20 },
    { id: "tpl-off-conference", name: "Hội nghị", kind: "conference", icon: "🎤", title: "Hội nghị", duration_minutes: 240, start_time: "08:00", repeat_weeks: 1, note: "Chương trình:\n- 08:00 Đón đại biểu\n- 08:30 Khai mạc\n- …", sort_order: 30 },
    { id: "tpl-off-reception", name: "Tiếp khách / Tiếp công dân", kind: "reception", icon: "🙋", title: "Tiếp công dân", duration_minutes: 120, start_time: "08:00", repeat_weeks: 1, note: "Đoàn / người đến:\nNội dung làm việc:", sort_order: 40 },
    { id: "tpl-off-trip", name: "Đi công tác", kind: "business_trip", icon: "🚗", title: "Công tác", duration_minutes: 480, start_time: "07:30", repeat_weeks: 1, note: "Địa điểm:\nThành phần đoàn:\nPhương tiện:", sort_order: 50 },
    { id: "tpl-off-duty", name: "Trực cơ quan", kind: "duty", icon: "🛡️", title: "Trực cơ quan", duration_minutes: 240, start_time: "07:30", repeat_weeks: 1, note: null, sort_order: 60 },
    { id: "tpl-off-training", name: "Tập huấn", kind: "training", icon: "📚", title: "Tập huấn", duration_minutes: 180, start_time: "08:00", repeat_weeks: 1, note: "Chủ đề:\nBáo cáo viên:\nĐối tượng tham dự:", sort_order: 70 },
  ],
};

export const PROFILES: Record<ProfileId, Profile> = { education: EDUCATION, business: BUSINESS, office: OFFICE };

export function getProfile(id: string | null | undefined): Profile {
  return PROFILES[(id ?? "education") as ProfileId] ?? EDUCATION;
}

/** Danh sách loại lịch để chọn – thêm loại hiện tại nếu nó không thuộc loại hình (lịch cũ). */
export function kindOptions(profile: Profile, current?: EventKind): EventKind[] {
  return current && !profile.kinds.includes(current) ? [...profile.kinds, current] : profile.kinds;
}
