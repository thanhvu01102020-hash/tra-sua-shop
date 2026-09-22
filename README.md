# Tiệm Trà Nhà Mình 🧋

Game mô phỏng quán trà sữa indie (MVP Ngày 1–3): pha chế, quản lý quán, và câu chuyện nhẹ. Toàn bộ giao diện tiếng Việt.

## Cách mở

### Cách 1 — Mở file trực tiếp
1. Vào thư mục `tra-sua-shop`
2. Mở `index.html` bằng trình duyệt (Chrome / Firefox / Edge)
3. Đường dẫn dạng: `file:///.../tra-sua-shop/index.html`

### Cách 2 — Máy chủ tĩnh (khuyến nghị nếu `file://` bị hạn chế)
Trong thư mục `tra-sua-shop`, chạy một trong các lệnh:

```bash
python3 -m http.server 8080
```

Rồi mở: http://localhost:8080/

Không cần npm, không cần build.

## Cách chơi

1. **Màn hình chính** → **Ván mới** → đặt tên tiệm (mặc định *Tiệm Trà Nhà Mình*).
2. Đọc đoạn chuyện buổi sáng → **Mở quán**.
3. Khách vào hàng chờ (thanh kiên nhẫn). Bấm **Nhận** ở khách đầu hàng.
4. Xem đơn → **Pha chế**: chọn base → sữa → topping → đường → đá → lắc/xay.
5. Đúng công thức + nhanh = tiền đầy đủ + tip; sai = mất uy tín; chậm = khách bỏ đi.
6. Hết khách → **Kết thúc ngày** → tóm tắt → chuyện tối (có lựa chọn Ngày 1) → nâng cấp / nhập hàng → ngày tiếp.
7. Tiến trình lưu vào `localStorage` (nút **Tiếp tục** trên màn hình chính).

Mẹo: mở **📖 Công thức** khi quên công thức. Nút 🔊 bật/tắt tiếng bip nhỏ.

## Có trong MVP

- 6 công thức (mở dần theo ngày): Trà sữa truyền thống, Trà đào, Matcha latte, Hồng trà kem cheese, Trà sữa khoai môn, Cacao sữa đá
- Vòng lặp Ngày 1–3: chuyện → quán → pha → kết ngày → nâng cấp
- Tiền, uy tín (sao), kho nguyên liệu, mục tiêu doanh thu ngày
- 4 nâng cấp: máy lắc nhanh, kệ topping thêm, bảng hiệu, thẻ giảm giá kho
- 3 NPC: Linh (sinh viên), Anh Hoàng (văn phòng), Chị Mai (hàng xóm)
- Lưu game, âm thanh tùy chọn (Web Audio)

## Cân bằng gợi ý

| Mục | Giá trị |
|-----|---------|
| Tiền đầu | 80.000đ |
| Uy tín đầu | 2.5 / 5 |
| Mục tiêu Ngày 1–3 | 60k / 100k / 150k |
| Khách/ngày | 4 / 5 / 6 (+nâng cấp bảng hiệu) |
| Thưởng đạt mục tiêu | +10.000đ |

## Cấu trúc thư mục

```
tra-sua-shop/
  index.html
  README.md
  css/style.css
  js/data.js      — công thức, NPC, chuyện, nâng cấp
  js/brew.js      — mini-game pha chế
  js/story.js     — hội thoại
  js/ui.js        — giao diện
  js/game.js      — state machine chính
```

## Giới hạn đã biết

- Chỉ 3 ngày (MVP); chưa có mùa / sự kiện dài.
- Không có hình ảnh ngoài emoji/CSS.
- Cân bằng tip/uy tín còn đơn giản.
- Mobile: chơi được nhưng tối ưu quanh ~900px trở lên.
