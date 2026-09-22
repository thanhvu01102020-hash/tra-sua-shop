# Tiệm Trà Nhà Mình 🧋

Game mô phỏng quán trà sữa indie: pha chế, món ăn nhẹ, nâng cấp thiết bị (Cấp 0→4), và câu chuyện nhẹ qua **30 ngày**. Toàn bộ giao diện tiếng Việt.

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
2. Chuyện sáng (ngày then chốt) → **Mở quán**.
3. Khách đi vào (animation) → **Nhận** → pha trà / chuẩn bị snack / combo.
4. Đúng + nhanh = tiền + tip + sao 1–5; sai / chậm = mất uy tín.
5. Hết khách → kết ngày → chuyện tối (có lựa chọn) → nâng cấp thiết bị / nhập hàng → ngày tiếp.
6. Sau ngày 30: màn hình kết thúc + **Ván mới**. Tiến trình lưu `localStorage` (v2; tự migrate bản cũ).

## Nội dung chính

- **6 đồ uống** mở dần · **6 món ăn nhẹ** (bánh mì que, tàu hủ, bánh su, khoai chiên, bánh tráng trộn, cookie matcha)
- Đơn: chỉ trà / chỉ snack / **combo** (combo nhiều hơn ngày sau)
- **10 thiết bị**, mỗi cái **Cấp 0→4**: máy lắc, máy xay, tủ lạnh, máy pha trà, quầy topping, bảng hiệu, ghế, POS, lò nướng, kệ trưng bày
- Walk-in animation + đánh giá sao sau phục vụ
- Chuyện then chốt ngày 1, 3, 7, 14, 21, 30 + lựa chọn nhỏ

## Cân bằng gợi ý

| Mục | Giá trị |
|-----|---------|
| Tiền đầu | 80.000đ |
| Uy tín đầu | 2.5 / 5 |
| Ngày | 1–30 |
| Mục tiêu DT | ~55k → ~420k (cong mượt) |
| Khách/ngày | ~4 → ~12 (+ thiết bị) |
| Thưởng đạt mục tiêu | +10.000đ |

## Cấu trúc

```
tra-sua-shop/
  index.html
  README.md
  css/style.css
  js/data.js   — công thức, snack, thiết bị, chuyện, scaling
  js/brew.js   — pha chế + prep snack
  js/story.js
  js/ui.js
  js/game.js
```

## Giới hạn

- Không có asset ngoài emoji/CSS.
- Combo prep nối tiếp (trà rồi snack), chưa song song thật.
- Mobile chơi được; tối ưu quanh ≥900px.
