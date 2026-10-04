# Lịch Giảng – Quản lý lịch giảng dạy

Ứng dụng đặt lịch giảng cho giảng viên: quản lý **giảng viên**, **phòng học** và **buổi giảng** trên lịch tuần,
tự động **phát hiện trùng lịch** (cùng giảng viên hoặc cùng phòng), hỗ trợ **lặp lại hằng tuần**. Giao diện glassmorphism.

## Kiến trúc

| Phần | Công nghệ |
| --- | --- |
| Giao diện | Next.js 16 (App Router) – static export (`out/`), Tailwind CSS v4 |
| API | Cloudflare Pages Functions – `functions/api/[[path]].ts` → `server/api.ts` |
| CSDL | Cloudflare D1 (SQLite) – `migrations/` |

```
src/app/            Trang: / (lịch tuần), /teachers, /rooms
src/components/     UI glass, WeekCalendar, SessionDialog
src/shared/types.ts Kiểu dữ liệu dùng chung cho UI và API
server/             Router API + logic kiểm tra trùng lịch (có unit test)
functions/          Entry Pages Functions
migrations/         Schema D1
seed/seed.sql       Dữ liệu mẫu
```

### API

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| GET/POST | `/api/teachers` | Danh sách / thêm giảng viên |
| PUT/DELETE | `/api/teachers/:id` | Sửa / xoá (409 nếu đang có lịch) |
| GET/POST | `/api/rooms` | Danh sách / thêm phòng |
| PUT/DELETE | `/api/rooms/:id` | Sửa / xoá (409 nếu đang có lịch) |
| GET | `/api/sessions?from=&to=&teacherId=&roomId=` | Lịch trong khoảng ngày |
| POST | `/api/sessions` | Đặt lịch (`repeat_weeks` 1–30), 409 kèm `conflicts` nếu trùng |
| PUT | `/api/sessions/:id` | Sửa / huỷ (`status: "cancelled"`) / khôi phục |
| DELETE | `/api/sessions/:id[?scope=following]` | Xoá buổi / xoá buổi này và các buổi sau trong chuỗi |

Buổi đã huỷ không tính là trùng lịch. Hai buổi nối tiếp (buổi trước kết thúc 09:00, buổi sau bắt đầu 09:00) không bị coi là trùng.

## Chạy local

```bash
npm install
npm run db:migrate:local      # tạo bảng trong D1 local
npm run db:seed:local         # (tuỳ chọn) dữ liệu mẫu

# Cách 1: dev có hot reload – 2 terminal
npm run dev:api               # Pages Functions + D1 tại :8788
npm run dev                   # Next.js tại :3000, proxy /api → :8788

# Cách 2: chạy bản build giống production
npm run preview               # http://localhost:8788
```

Kiểm tra: `npm run typecheck`, `npm run lint`, `npm test`.

## Deploy lên Cloudflare Pages

1. Tạo D1 và chép `database_id` vào `wrangler.toml`:
   ```bash
   npx wrangler login
   npx wrangler d1 create scheduler-db
   npm run db:migrate:remote
   ```
2. Deploy:
   - **Bằng CLI:** `npm run deploy`
   - **Hoặc nối Git** trong Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git:
     Build command `npm run build`, Build output directory `out`. Cloudflare đọc binding `DB` từ `wrangler.toml`
     (hoặc thêm binding D1 tên `DB` ở Settings → Bindings).

> **Bảo mật:** bản này chưa có đăng nhập. Trước khi dùng thật, nên bật
> [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-public-app/)
> cho domain Pages để chỉ người được phép mới truy cập được.
