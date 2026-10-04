// Các hàm thuần xử lý ngày/giờ (không phụ thuộc runtime) để dễ test.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isValidTime(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}

/** Hai khoảng [aStart, aEnd) và [bStart, bEnd) có giao nhau không (HH:MM so sánh chuỗi được). */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Danh sách ngày lặp lại hằng tuần, bắt đầu từ `date`. */
export function weeklyDates(date: string, weeks: number): string[] {
  return Array.from({ length: weeks }, (_, i) => addDays(date, i * 7));
}
