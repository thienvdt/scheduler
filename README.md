# Lịch – Đặt lịch giảng dạy, họp, công tác

Ứng dụng đặt lịch cho **trường học, doanh nghiệp, văn phòng – hành chính**: quản lý người, phòng và lịch trên lịch tuần,
tự động **phát hiện trùng lịch** (cùng người hoặc cùng phòng), mẫu lịch, tìm giờ trống, đặt lịch bằng giọng nói.
Giao diện glassmorphism, cài được như ứng dụng (PWA).

## Loại hình sử dụng

Chọn khi thiết lập lần đầu, quản trị viên đổi được ở trang **Cài đặt** (áp dụng cho cả đơn vị; dữ liệu cũ giữ nguyên):

| | 🎓 Trường học / Giáo viên | 🏢 Doanh nghiệp | 🏛️ Văn phòng / Hành chính |
| --- | --- | --- | --- |
| Người · Phòng · Nhóm | Giảng viên · Phòng học · Lớp | Nhân viên · Phòng họp · Khách hàng / Dự án | Cán bộ · Phòng · Đơn vị / Đối tác |
| Loại lịch | giảng dạy, thực hành, coi thi, bảo vệ, họp, seminar, tiếp SV | họp, gặp khách hàng, 1:1, phỏng vấn, đào tạo, workshop, công tác | giao ban, hội nghị, tiếp khách / tiếp dân, công tác, trực, tập huấn |
| Mẫu lịch mặc định | 8 mẫu (họp bộ môn, coi thi…) | 8 mẫu (giao ban tuần, gặp KH, 1:1…) | 7 mẫu (giao ban, hội nghị, trực…) |
| Báo cáo "công việc chính" | giờ giảng | giờ khách hàng & đào tạo | giờ tiếp khách, công tác & trực |

Có sẵn 2 **phòng ảo** – *Online* và *Bên ngoài / Công tác* – không bị kiểm tra trùng phòng (vẫn kiểm tra trùng người),
dùng cho họp online, đi công tác. Quản trị viên có thể đánh dấu thêm phòng ảo.

## Tính năng

- **Hướng dẫn ngay trên trang:** lần đầu đăng nhập, app tự mở tour 12 bước – làm nổi bật từng nút (menu, Đặt lịch, Từ mẫu,
  Giọng nói, Tìm giờ trống, lịch tuần, bộ lọc…) kèm bong bóng giải thích; phím ← → / Esc. Mở lại bất cứ lúc nào ở menu tài
  khoản → **📘 Hướng dẫn sử dụng** (hoặc thêm `#tour` vào đường dẫn).
- **Nhập thời khoá biểu từ app GVCN / GVBM** (menu tài khoản → *📥 Nhập thời khoá biểu*, hoặc Cài đặt):
  - Nếu **localStorage** của trình duyệt có dữ liệu giống thời khoá biểu (app kia chạy cùng tên miền), trang Lịch **hỏi người
    dùng có muốn import không** (Có / Để sau / Không, đừng hỏi lại). Không tự nhập gì.
  - App ở **tên miền khác** (vd. quanlylophoc.aistudybuddy.vn): trình duyệt không cho đọc chéo localStorage, nên dùng dấu trang
    **📥 Gửi sang Lịch** (bookmarklet) – bấm khi đang mở app kia, dữ liệu được gửi sang trang Nhập qua `postMessage`.
  - Hoặc chọn file **CSV** (Excel → Lưu thành CSV UTF-8) / **JSON**, hoặc dán dữ liệu.
  - Tự tìm bảng (kể cả dạng lồng `{lớp: {thứ: [tiết…]}}`), đoán cột (thứ, tiết, buổi, môn, lớp, phòng, giáo viên…; tiếng Việt
    có/không dấu, tiếng Anh), đổi tiết → giờ theo bảng giờ chỉnh được, gộp tiết liền nhau. Xem trước → **Kiểm tra trùng lịch**
    → **Import**: lặp N tuần, tạo giáo viên / phòng còn thiếu, bỏ qua (và liệt kê) buổi trùng – nhập lại cùng dữ liệu không bị nhân đôi.
  - Giáo viên tự nhập: lịch luôn đứng tên mình, mặc định chỉ lấy tiết có tên mình; không tạo được giáo viên / phòng mới.
- **Dữ liệu mẫu:** quản trị viên bấm *Nạp dữ liệu mẫu* (ngay ở bước đầu của tour, ở thông báo khi hệ thống còn trống, hoặc
  trong *Cài đặt*) để có sẵn người, phòng và ~35 lịch theo loại hình đang dùng (trường học / doanh nghiệp / văn phòng), đặt vào
  tuần hiện tại và lặp vài tuần. Dữ liệu mẫu có mã `mau-…` nên *Xoá dữ liệu mẫu* trong Cài đặt xoá sạch, không đụng dữ liệu thật.
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
server/             api.ts (router, danh mục), sessions.ts (lịch, trùng lịch), auth.ts (đăng nhập, tài khoản),
                    settings.ts (loại hình, tên đơn vị)
functions/          Entry Pages Functions
migrations/         Schema D1 (0001 bảng chính, 0002 loại lịch + mẫu lịch, 0003 người tham dự + tài khoản,
                    0004 cài đặt loại hình + phòng ảo)
scripts/            setup-cloudflare.mjs – cài đặt một lệnh; hash-password.mjs – đặt lại mật khẩu quản trị
src/shared/profiles.ts  Loại hình: cách gọi, loại lịch, mẫu lịch mặc định
public/             Manifest, icon, service worker (PWA)
seed/seed.sql       Dữ liệu mẫu
```

### API

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| GET | `/api/auth/me` | Người dùng hiện tại, `needs_setup` khi chưa có tài khoản nào |
| POST | `/api/auth/setup` · `login` · `logout` · `password` | Tạo quản trị viên đầu tiên / đăng nhập / đăng xuất / đổi mật khẩu |
| GET/POST, PUT/DELETE | `/api/users`, `/api/users/:id` | Quản lý tài khoản (quản trị viên) |
| GET/PUT | `/api/settings` | Loại hình, tên đơn vị (sửa: quản trị viên; `add_templates` thêm mẫu mặc định) |
| POST | `/api/import` | Nhập thời khoá biểu `{items, start_date, weeks, dry_run}` → số buổi tạo / bỏ qua (giáo viên: chỉ lịch của mình) |
| GET/POST | `/api/settings/sample` | Số bản ghi mẫu / `{"action":"load"}` nạp (lại) hoặc `{"action":"clear"}` xoá dữ liệu mẫu (quản trị viên) |
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

## Lưu trữ & chi phí: mỗi đơn vị dùng tài khoản Cloudflare của chính mình

App không có máy chủ trung tâm: **mỗi trường / doanh nghiệp cài app lên tài khoản Cloudflare của họ**. Dữ liệu nằm trong
cơ sở dữ liệu D1 của chính đơn vị đó, bạn (người phát triển) không phải trả tiền lưu trữ cho ai.

- **Miễn phí** với gói Free của Cloudflare – đủ cho hầu hết đơn vị vừa và nhỏ. Hạn mức tham khảo (xem bảng giá mới nhất tại
  [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) và
  [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)): D1 ~5 GB dữ liệu, ~5 triệu dòng đọc và
  ~100.000 dòng ghi mỗi ngày; ~100.000 request API (Pages Functions) mỗi ngày. Một đơn vị 200 người đặt vài trăm lịch/ngày chỉ
  dùng một phần rất nhỏ.
- **Khi vượt hạn mức**, đơn vị tự nâng cấp lên gói Workers Paid (khoảng 5 USD/tháng) trong tài khoản Cloudflare của họ –
  thanh toán trực tiếp với Cloudflare.
- Dữ liệu thuộc quyền đơn vị; sao lưu bằng `npx wrangler d1 export DB --remote --output backup.sql`.

### Cài đặt bằng một lệnh

```bash
git clone <repo> && cd scheduler && npm install
npm run setup:cloudflare
```

Script sẽ: mở trình duyệt để đăng nhập (hoặc tạo tài khoản Cloudflare miễn phí) → hỏi tên dự án → tạo D1 (mặc định đặt ở
châu Á – `apac`) → ghi `database_id` vào `wrangler.toml` → tạo bảng → build → tạo dự án Pages và deploy, rồi in ra địa chỉ
`https://<tên>.pages.dev`. Mở địa chỉ đó **ngay** để chọn loại hình và tạo tài khoản quản trị.

- Không hỏi lại: `npm run setup:cloudflare -- --name=lich-truong-abc --location=apac`
- Xem trước các lệnh mà không thực hiện: `npm run setup:cloudflare -- --dry-run`
- **Mô phỏng toàn bộ trên máy, không cần tài khoản Cloudflare:** `npm run simulate:cloudflare -- --name=lich-truong-abc`
  – chạy thật mọi bước (tạo D1, tạo bảng, build, chạy app) trên Cloudflare giả lập, dữ liệu riêng trong
  `.wrangler/simulate/<tên>`, không sửa `wrangler.toml`; mở `http://localhost:8790` để thử như bản thật, Ctrl+C để dừng.
- Cập nhật phiên bản mới về sau: `git pull && npm run db:migrate:remote && npm run deploy`
- Gắn tên miền riêng (vd. `lich.truongabc.edu.vn`): Cloudflare dashboard → Workers & Pages → dự án → *Custom domains*.

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

## Deploy thủ công lên Cloudflare Pages

(Cách nhanh hơn: `npm run setup:cloudflare` ở trên.)

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
