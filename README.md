# Tiệm Trà Nhà Mình 🧋

Game mô phỏng quán trà sữa indie: pha chế, món ăn nhẹ, **tại chỗ / mang đi**, bàn & dọn bàn, thuê nhân viên, nâng cấp thiết bị (Cấp 0→4), câu chuyện nhẹ qua **30 ngày**. UI tiếng Việt.

## Cách mở

### Cách 1 — Mở file trực tiếp
1. Vào thư mục `tra-sua-shop`
2. Mở `index.html` bằng trình duyệt

### Cách 2 — Máy chủ tĩnh
```bash
python3 -m http.server 8080
```
Mở http://localhost:8080/ — không cần npm.

## Cách chơi

1. **Ván mới** → đặt tên tiệm.
2. Chuyện sáng → **Mở quán**.
3. Khách **mang đi** xếp hàng quầy; khách **tại chỗ** ngồi bàn.
4. **Nhận đơn** → pha / chuẩn bị → **Giao mang đi** hoặc **Bưng món** tới bàn.
5. Khách tại chỗ ăn xong → trả sao → bàn **bẩn** → **Dọn bàn** (hoặc nhân viên làm hộ).
6. Hết khách → kết ngày → chuyện tối → nâng cấp / nhập hàng / **thuê nhân viên** → ngày tiếp.
7. Sau ngày 30: kết thúc (gồm số nhân viên) + Ván mới. Lưu `localStorage` **v3** (migrate từ v1/v2).

## Nội dung chính

- Đơn ngẫu nhiên mỗi khách: chỉ trà / chỉ snack / **combo** (trọng số theo ngày + menu đã mở)
- **Tại chỗ** sit bàn · **Mang đi** lấy túi ở quầy
- Bàn: trống / có khách / bẩn / đang dọn (2→~6 theo ngày + ghế)
- Nhân viên: Thu ngân/pha chế · Phục vụ · Tạp vụ (lương/ngày, slot tăng dần)
- 6 đồ uống · 6 snack · 10 thiết bị Cấp 0→4 · walk animation · sao 1–5
- Chuyện then chốt ngày 1, 3, 7, 14, 21, 30

## Cân bằng gợi ý

| Mục | Giá trị |
|-----|---------|
| Tiền đầu | 80.000đ |
| Uy tín đầu | 2.5 / 5 |
| Ngày | 1–30 |
| Bàn | 2 (đầu) → ~6 |
| NV | 0 slot ngày 1–2 · 1→3 sau đó |
| Mục tiêu DT | ~55k → ~420k |
| Khách/ngày | ~4 → ~12 (+ thiết bị) |

## Cấu trúc

```
tra-sua-shop/
  index.html
  README.md
  css/style.css
  js/data.js   — công thức, snack, thiết bị, staff, scaling
  js/brew.js   — pha chế + prep snack
  js/story.js
  js/ui.js
  js/game.js
```

## Giới hạn

- Không có asset ngoài emoji/CSS.
- Combo prep nối tiếp (trà rồi snack).
- Staff AI đơn giản (timer), chưa pathfinding.
- Mobile chơi được; tối ưu quanh ≥900px.
