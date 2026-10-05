import type { Template } from "@/shared/types";
import { KIND_META } from "@/shared/types";
import { minutesToTime, timeToMinutes } from "./date";

const LAST_MINUTE = 23 * 60 + 59;

export function templateIcon(t: Pick<Template, "icon" | "kind">): string {
  return t.icon || KIND_META[t.kind].icon;
}

/** Giờ kết thúc = bắt đầu + thời lượng (không vượt quá 23:59). */
export function endAfter(start: string, minutes: number): string {
  return minutesToTime(Math.min(timeToMinutes(start) + minutes, LAST_MINUTE));
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} phút`;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}
