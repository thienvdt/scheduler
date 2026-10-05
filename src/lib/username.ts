// Gợi ý tên đăng nhập từ họ tên theo kiểu quen thuộc ở Việt Nam:
// tên gọi + chữ cái đầu của họ và tên đệm, bỏ học hàm/chức danh. "ThS. Nguyễn Văn An" → "annv".

const TITLES = /^(?:ths|ts|tskh|pgs|gs|cn|ks|bs|ls|ong|ba|anh|chi)$/;

const ascii = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export function suggestUsername(fullName: string): string {
  const words = fullName
    .trim()
    .split(/\s+/)
    .filter((w) => !TITLES.test(ascii(w)))
    .map(ascii)
    .filter(Boolean);
  if (!words.length) return "";
  const given = words[words.length - 1];
  const initials = words.slice(0, -1).map((w) => w[0]).join("");
  const name = given + initials;
  // Tên đăng nhập cần tối thiểu 3 ký tự
  return name.length >= 3 ? name : (name + "user").slice(0, Math.max(3, name.length + 4));
}
