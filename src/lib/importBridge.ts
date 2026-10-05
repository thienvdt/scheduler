// Cầu nối lấy localStorage của app khác (khác tên miền) sang trang Nhập dữ liệu.
// Trình duyệt không cho trang này đọc localStorage của tên miền khác, nên người dùng chạy một
// bookmarklet NGAY TRÊN app kia: nó mở trang /import/?bridge=1 rồi gửi dữ liệu qua postMessage.

export const BRIDGE_READY = "lich-giang:ready";
export const BRIDGE_DATA = "lich-giang:import";
/** Dataset người dùng chọn từ hộp hỏi ở trang Lịch (sessionStorage) */
export const IMPORT_PICK = "import-pick";
/** Giới hạn dữ liệu nhận qua cầu nối */
const MAX_BYTES = 10 * 1024 * 1024;

export interface Bridged {
  origin: string;
  title: string;
  entries: Record<string, string>;
}

/** Mã bookmarklet cho trang lịch đang chạy ở `origin` (+ thư mục con `base`, vd. "/scheduler"). */
export function bookmarklet(origin: string, base = ""): string {
  const code = `(()=>{const T=${JSON.stringify(origin)},B=${JSON.stringify(base)};const d={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);d[k]=localStorage.getItem(k)}const w=window.open(T+B+"/import/?bridge=1","_blank");if(!w){alert("Trình duyệt đã chặn cửa sổ mới – hãy cho phép cửa sổ bật lên rồi bấm lại.");return}const f=e=>{if(e.origin===T&&e.source===w&&e.data&&e.data.type===${JSON.stringify(BRIDGE_READY)}){w.postMessage({type:${JSON.stringify(BRIDGE_DATA)},entries:d,title:document.title},T);removeEventListener("message",f)}};addEventListener("message",f)})()`;
  return `javascript:${encodeURIComponent(code)}`;
}

/** Kiểm tra dữ liệu nhận được: chỉ chấp nhận object {khoá: chuỗi}, giới hạn dung lượng. */
export function readBridgeMessage(e: MessageEvent): Bridged | null {
  const data = e.data as { type?: unknown; entries?: unknown; title?: unknown } | null;
  if (!data || data.type !== BRIDGE_DATA || typeof data.entries !== "object" || data.entries === null) return null;
  const entries: Record<string, string> = {};
  let size = 0;
  for (const [k, v] of Object.entries(data.entries as Record<string, unknown>)) {
    if (typeof v !== "string") continue;
    size += k.length + v.length;
    if (size > MAX_BYTES) return null;
    entries[k] = v;
  }
  return { origin: e.origin, title: typeof data.title === "string" ? data.title.slice(0, 200) : "", entries };
}
