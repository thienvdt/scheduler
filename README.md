# Lịch Giảng – Quản lý lịch giảng dạy

Ứng dụng đặt lịch giảng cho giảng viên: quản lý **giảng viên**, **phòng học** và **buổi giảng** trên lịch tuần,
tự động **phát hiện trùng lịch** (cùng giảng viên hoặc cùng phòng), hỗ trợ **lặp lại hằng tuần**. Giao diện glassmorphism.

## Tính năng

- **Lịch tuần** và **dạng danh sách** (tự dùng danh sách trên điện thoại), lọc theo giảng viên, phòng, loại lịch.
- **Loại lịch:** giảng dạy, thực hành, cuộc họp, seminar, coi thi, bảo vệ, tiếp sinh viên, khác.
- **Mẫu lịch** (trang *Mẫu lịch*): 8 mẫu có sẵn (họp bộ môn, họp khoa, seminar, coi thi, bảo vệ đồ án…), người dùng tự tạo / sửa /
  nhân bản. Chọn mẫu bằng nút **📋 Từ mẫu** hoặc các nút mẫu trong form đặt lịch để điền sẵn tiêu đề, thời lượng, giờ, phòng,
  người chủ trì, nội dung.
- **Phát hiện trùng lịch** theo giảng viên và phòng, **lặp hằng tuần**, huỷ / khôi phục, xoá chuỗi lặp.
- **Người tham dự:** cuộc họp, seminar… có nhiều người tham dự (nút *+ Cả khoa* mời nhanh cả bộ môn của người chủ trì).
  Trùng lịch được kiểm tra cho **tất cả** người chủ trì và người tham dự; lọc theo giảng viên và báo cáo khối lượng cũng
  tính cả lịch người đó tham dự.
- **Đăng nhập & phân quyền:** *Quản trị viên* quản lý mọi thứ (giảng viên, phòng, mẫu lịch, tài khoản, mọi lịch).
  *Giảng viên* xem toàn bộ lịch, nhưng chỉ tạo / sửa / xoá lịch do chính mình chủ trì; lịch của người khác mở ở chế độ chỉ xem.
- **Kéo thả** trên lịch tuần (chuột/bút): kéo khối để đổi ngày, giờ; kéo mép dưới để đổi thời lượng (bước 15 phút, Esc để huỷ).
  Nếu trùng lịch, app báo lỗi và đưa lịch về chỗ cũ. Trên màn hình cảm ứng giữ thao tác cuộn – chạm để mở và sửa.
- **Tìm giờ trống:** chọn những người cần có mặt, thời lượng, tuần, buổi (sáng/chiều/tối), phòng hoặc sức chứa tối thiểu →
  danh sách khung giờ mọi người cùng rảnh và còn phòng trống. Bấm một khung giờ để đặt lịch ngay (đã điền sẵn người tham dự,
  phòng). Khi đặt lịch bị trùng, nút *Tìm giờ trống phù hợp* mở công cụ này với thông tin của form.
- **Đặt lịch bằng giọng nói** (xem bên dưới).
- **Xuất lịch .ics** (nút 📅 Xuất .ics) theo bộ lọc đang chọn – tuần / 4 tuần / học kỳ, có nhắc trước – để nhập vào
  Google Calendar, Outlook, Lịch điện thoại.
- **Báo cáo khối lượng** (trang *Báo cáo*): giờ giảng, giờ họp & sự kiện theo giảng viên, xuất CSV mở bằng Excel.
- **Cài như ứng dụng (PWA):** nút *Lưu ra màn hình* (điện thoại) / *Cài lên máy tính* (desktop).
  Chrome/Edge (Windows, macOS, Android) hiện hộp thoại cài ngay – trên Windows có tuỳ chọn tạo lối tắt Desktop.
  iPhone/iPad và Safari trên Mac không cho phép web tự cài, nên app hiện hướng dẫn từng bước (Chia sẻ → Thêm vào MH chính,
  hoặc Tệp → Thêm vào Dock). Firefox chưa hỗ trợ cài app.

## Đặt lịch bằng giọng nói

Nút **🎤 Giọng nói** trên trang lịch: nói (hoặc gõ) một câu, app tự điền form đặt lịch để bạn kiểm tra rồi lưu. Ví dụ:

> Thứ 3 tuần sau thầy An dạy Lập trình Web lớp K66A phòng A101 từ 7 giờ đến 9 giờ 30, lặp 10 tuần

- Nhận dạng giọng nói dùng Web Speech API của trình duyệt (`vi-VN`), miễn phí, cần Chrome/Edge/Safari, HTTPS và Internet.
  Lưu ý: Chrome gửi âm thanh tới máy chủ Google để nhận dạng. Firefox chưa hỗ trợ nên chỉ gõ được.
- Câu lệnh được phân tích ngay trên trình duyệt bởi `src/lib/voiceParser.ts` (có unit test). Hiểu được:
  thứ/chủ nhật (kèm "tuần sau"), "hôm nay/ngày mai", ngày "20/10" hoặc "5 tháng 1"; giờ "7h30", "từ 1 đến 3 giờ chiều",
  "rưỡi", "trong 2 tiếng"; giảng viên theo họ tên hoặc "thầy/cô + tên"; phòng; "lớp …"; "môn …" / "dạy …"; "lặp N tuần".
- Giờ 1–6 không nói rõ buổi được hiểu là buổi chiều. Nếu tên gọi trùng giữa nhiều giảng viên, app để trống cho bạn tự chọn.

## Kiến trúc

| Phần | Công nghệ |
| --- | --- |
| Giao diện | Next.js 16 (App Router) – static export (`out/`), Tailwind CSS v4 |
| API | Cloudflare Pages Functions – `functions/api/[[path]].ts` → `server/api.ts` |
| CSDL | Cloudflare D1 (SQLite) – `migrations/` |

```
src/app/            Trang: / (lịch), /teachers, /rooms, /templates, /reports
src/components/     UI glass, WeekCalendar, SessionDialog
src/shared/types.ts Kiểu dữ liệu dùng chung cho UI và API
server/             api.ts (router, danh mục), sessions.ts (lịch, trùng lịch), auth.ts (đăng nhập, tài khoản)
functions/          Entry Pages Functions
migrations/         Schema D1 (0001 bảng chính, 0002 loại lịch + mẫu lịch, 0003 người tham dự + tài khoản)
scripts/            hash-password.mjs – tạo mã băm mật khẩu (đặt lại mật khẩu quản trị)
public/             Manifest, icon, service worker (PWA)
seed/seed.sql       Dữ liệu mẫu
```

### API

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| GET | `/api/auth/me` | Người dùng hiện tại, `needs_setup` khi chưa có tài khoản nào |
| POST | `/api/auth/setup` · `login` · `logout` · `password` | Tạo quản trị viên đầu tiên / đăng nhập / đăng xuất / đổi mật khẩu |
| GET/POST, PUT/DELETE | `/api/users`, `/api/users/:id` | Quản lý tài khoản (quản trị viên) |
| GET/POST | `/api/teachers` | Danh sách / thêm giảng viên |
| PUT/DELETE | `/api/teachers/:id` | Sửa / xoá (409 nếu đang có lịch) |
| GET/POST | `/api/rooms` | Danh sách / thêm phòng |
| PUT/DELETE | `/api/rooms/:id` | Sửa / xoá (409 nếu đang có lịch) |
| GET/POST | `/api/templates` | Danh sách / thêm mẫu lịch |
| PUT/DELETE | `/api/templates/:id` | Sửa / xoá mẫu lịch |
| GET | `/api/sessions?from=&to=&teacherId=&roomId=&kind=` | Lịch trong khoảng ngày |
| POST | `/api/sessions` | Đặt lịch (`repeat_weeks` 1–30, `participant_ids`), 409 kèm `conflicts` nếu trùng |
| PUT | `/api/sessions/:id` | Sửa / huỷ (`status: "cancelled"`) / khôi phục |
| DELETE | `/api/sessions/:id[?scope=following]` | Xoá buổi / xoá buổi này và các buổi sau trong chuỗi |

Mọi API (trừ `health` và `auth/*`) cần đăng nhập. Xem: mọi tài khoản. Thêm/sửa giảng viên, phòng, mẫu lịch, tài khoản:
quản trị viên. Lịch: quản trị viên, hoặc giảng viên là người chủ trì.

Buổi đã huỷ không tính là trùng lịch. Hai buổi nối tiếp (buổi trước kết thúc 09:00, buổi sau bắt đầu 09:00) không bị coi là trùng.

## Chạy local

```bash
npm install
npm run db:migrate:local      # tạo bảng trong D1 local
npm run db:seed:local         # (tuỳ chọn) dữ liệu mẫu + tài khoản mẫu:
                              #   admin / admin12345 (quản trị), an / giangvien123, binh / giangvien123 (giảng viên)

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
3. **Mở trang web ngay sau khi deploy** và tạo tài khoản quản trị ở màn hình *Thiết lập lần đầu* (màn hình này chỉ xuất hiện
   khi chưa có tài khoản nào – ai mở trước sẽ là quản trị viên, nên hãy làm ngay). Sau đó vào trang **Tài khoản** để tạo
   tài khoản cho từng giảng viên (có nút tạo nhanh cho giảng viên chưa có tài khoản).

### Bảo mật & tài khoản

- Mật khẩu băm PBKDF2-SHA256 (100.000 vòng); phiên đăng nhập là cookie `HttpOnly`, `SameSite=Lax`, `Secure` (trên HTTPS),
  hết hạn sau 30 ngày; DB chỉ lưu SHA-256 của token. Request thay đổi dữ liệu từ domain khác bị chặn.
- Sai mật khẩu 10 lần với cùng tên đăng nhập → khoá đăng nhập tên đó 15 phút. Nên thêm
  [Rate limiting rule](https://developers.cloudflare.com/waf/rate-limiting-rules/) cho `/api/auth/login` nếu mở ra Internet.
- Đổi mật khẩu → đăng xuất các thiết bị khác. Quản trị viên đặt lại mật khẩu → người đó bị đăng xuất mọi nơi.
- **Quên mật khẩu quản trị:**
  ```bash
  node scripts/hash-password.mjs 'MatKhauMoi123'
  npx wrangler d1 execute scheduler-db --remote --command "UPDATE users SET password_hash='<kết quả>' WHERE username='admin'"
  ```
