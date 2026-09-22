# 🌿 Google Apps Script: Form Nhập Liệu Khách Hàng & Báo Cáo Tổng Hợp Chiến Giá

Hệ thống nhập liệu thông tin khách hàng chuyên nghiệp chạy trực tiếp trên **GitHub Pages** và đồng bộ tức thời với **Google Sheets**, thiết kế chuẩn **Tone Xanh Lá Pastel** sang trọng.

### 🌐 Link Truy Cập Ứng Dụng:
- **Giao diện Web App (GitHub Pages)**: 👉 **[https://leevu221-lang.github.io/chiengia/](https://leevu221-lang.github.io/chiengia/)**
- **Trang tính Google Sheet**: 👉 **[Xem Trang Tính](https://docs.google.com/spreadsheets/d/1TBYhGWoe7cVwCx0oBV3d7uAPeFMza6KgsaW7NM9DTa0/edit?usp=sharing)**
- **Google Apps Script Web App**: `https://script.google.com/macros/s/AKfycbxE2Rm3_eyImKCAX5FSJ0BajF7AlaFaxqhlVj4nsgwkXnjtvlMgDiQDCYZ-gt9IJlLB/exec`

---

## 🌟 Tính Năng Nổi Bật

- **🎨 Giao diện chuẩn Tone Xanh Lá Pastel**:
  - Tông màu xanh mint/sage dịu mắt (`#10b981`, `#ecfdf5`, `#065f46`), phong cách thẻ bo góc 24px, glassmorphism hiện đại.
  - Đồng hồ thời gian thực (`🟢 HH:mm:ss dd/MM/yyyy`) chạy trực tiếp từng giây.
- **🎯 Ô tick "Chiến Giá" (Mặc định: `false`)**:
  - Thiết kế công tắc chuyển đổi (toggle switch) trực quan.
  - Tự động đánh dấu đơn có chiến giá hoặc không chiến giá.
- **⚡ Thao tác siêu tốc**:
  - Hỗ trợ phím tắt `Enter` nhảy giữa các ô và `Ctrl + Enter` (hoặc `Cmd + Enter`) để lưu nhanh.
  - Tự động ghi nhớ **Mã nhân viên** vào `localStorage` cho các lượt nhập tiếp theo mà không cần gõ lại.
  - Tự động đặt lại form và đưa con trỏ về ô *Khách Hàng* ngay sau khi lưu.
  - Âm thanh phản hồi Web Audio nhẹ nhàng khi lưu thành công hoặc báo lỗi.
- **📊 Đồng bộ dữ liệu kép**:
  - **Sheet `DATA`**: Lưu toàn bộ lịch sử 8 cột chi tiết, tự động đánh STT, chuẩn hóa SĐT giữ nguyên số `0` ở đầu.
  - **Sheet `TỔNG HỢP`**: Tự động gom nhóm theo **Ngày** và **Nhân viên**, thống kê chính xác:
    - *Số đơn chiến giá*
    - *Số đơn không chiến giá*
    - *Tổng số đơn*
    - *Tỷ lệ chiến giá (%)*
    - *Dòng TỔNG CỘNG in đậm nổi bật*

---

## 📂 Cấu Trúc Mã Nguồn

```
appscript-chien-gia/
├── Code.gs             # Backend Apps Script: Xử lý ghi Sheet DATA, tính toán Sheet TỔNG HỢP, bảo vệ LockService
├── index.html          # Frontend giao diện: Tone xanh pastel, live clock, toggle chiến giá, audio, hotkeys
├── README.md           # Tài liệu hướng dẫn sử dụng và triển khai
└── .gitignore          # Cấu hình bỏ qua file tạm hệ thống
```

---

## 📋 Cấu Trúc Dữ Liệu Các Sheet

### 1. Sheet `DATA`
| Cột | Tên Cột | Định dạng | Ví dụ |
| :---: | :--- | :---: | :--- |
| **A** | **STT** | Số tự tăng | `1` |
| **B** | **THỜI GIAN** | `dd/MM/yyyy HH:mm:ss` | `22/09/2026 13:14:36` |
| **C** | **NGÀY** | `dd/MM/yyyy` | `22/09/2026` |
| **D** | **KHÁCH HÀNG** | Text | `Nguyễn Văn A` |
| **E** | **SỐ ĐIỆN THOẠI** | Text (giữ số 0) | `'0987654321` |
| **F** | **SẢN PHẨM & LÝ DO RA VỀ** | Text | `Tivi 32 inch Sony, khách phân vân về giá` |
| **G** | **NHÂN VIÊN PHỤ TRÁCH** | Text | `38834` |
| **H** | **CHIẾN GIÁ** | Badge | `Có` / `Không` |

### 2. Sheet `TỔNG HỢP`
| Cột | Tên Cột | Mô tả |
| :---: | :--- | :--- |
| **A** | **STT** | Số thứ tự dòng tổng hợp |
| **B** | **NGÀY** | Ngày bán hàng / tiếp khách |
| **C** | **NHÂN VIÊN PHỤ TRÁCH** | Mã hoặc tên nhân viên phụ trách |
| **D** | **ĐƠN CHIẾN GIÁ** | Tổng số khách hàng có thương lượng giá |
| **E** | **ĐƠN KHÔNG CHIẾN GIÁ** | Tổng số khách hàng giá niêm yết chuẩn |
| **F** | **TỔNG SỐ ĐƠN** | `= Đơn chiến giá + Đơn không chiến giá` |
| **G** | **TỶ LỆ CHIẾN GIÁ** | Tỷ lệ phần trăm (`%`) |
| **-** | **TỔNG CỘNG** | Hàng chốt cuối bảng tính tổng toàn bộ các cột |

---

## 🚀 Hướng Dẫn Cài Đặt Lên Google Sheets

### Bước 1: Mở trình soạn thảo Google Apps Script
1. Truy cập vào trang tính Google Sheet của bạn:
   👉 [Link Google Sheet](https://docs.google.com/spreadsheets/d/1TBYhGWoe7cVwCx0oBV3d7uAPeFMza6KgsaW7NM9DTa0/edit)
2. Trên thanh menu, chọn: **Tiện ích mở rộng** (Extensions) ➔ **Apps Script**.

### Bước 2: Dán mã nguồn vào dự án
1. Tại file `Mã.gs` (hoặc `Code.gs`): Xóa toàn bộ nội dung cũ và dán toàn bộ nội dung từ file [`Code.gs`](file:///Users/linhvu/.gemini/antigravity-ide/scratch/appscript-chien-gia/Code.gs).
2. Nhấn biểu tượng dấu **+** bên cạnh mục *Tệp* (Files) ➔ Chọn **HTML** ➔ Đặt tên là `index` (chú ý chữ thường không hoa).
3. Dán toàn bộ nội dung từ file [`index.html`](file:///Users/linhvu/.gemini/antigravity-ide/scratch/appscript-chien-gia/index.html).
4. Bấm biểu tượng 💾 **Lưu dự án** (Save project).

### Bước 3: Cấp quyền và chạy lần đầu
1. Tại menu hàm trên thanh công cụ của Apps Script, chọn hàm `formatSheetsManual` hoặc `onOpen` rồi nhấn **Chạy** (Run).
2. Google sẽ hiện thông báo xác thực quyền truy cập Google Sheets:
   - Nhấn **Xem lại quyền** (Review Permissions).
   - Chọn tài khoản Google của bạn.
   - Nhấn **Nâng cao** (Advanced) ➔ Chọn **Đi tới [Tên dự án] (Không an toàn)**.
   - Nhấn **Cho phép** (Allow).
3. Quay lại Google Sheet, bạn sẽ thấy xuất hiện menu mới: **🌿 Quản Lý Nhập Liệu**.

---

## 🌐 Triển Khai Web App (Mở Nhập Liệu Độc Lập)

Nếu bạn muốn nhân viên mở link nhập liệu trên điện thoại, máy tính bảng hoặc máy tính riêng:
1. Tại trang Apps Script, bấm nút **Triển khai** (Deploy) ở góc trên bên phải ➔ **Quản lý bản triển khai** (hoặc **Bản triển khai mới** - New deployment).
2. Nhấn chọn loại hình: **Ứng dụng web** (Web app).
3. Cấu hình:
   - **Mô tả**: Form Nhập Liệu Chiến Giá V1.
   - **Thực thi dưới dạng**: *Tôi* (My account / User accessing).
   - **Ai có quyền truy cập**: *Bất kỳ ai* (Anyone) - Để nhân viên vào link là nhập được ngay không cần đăng nhập phức tạp.
4. Bấm **Triển khai** (Deploy) ➔ Sao chép liên kết URL Web App gửi cho nhân viên sử dụng!

---

## 💡 Các Tùy Chọn Mở Form

1. **Mở Sidebar (Bên phải Google Sheet)**:
   - Vào menu `🌿 Quản Lý Nhập Liệu` ➔ Chọn `▶ Mở Form Nhập Liệu (Bên phải - Sidebar)`.
   - Vừa nhập liệu vừa quan sát bảng tính cập nhật tức thì.
2. **Mở Hộp Thoại (Modal Dialog ở giữa)**:
   - Vào menu `🌿 Quản Lý Nhập Liệu` ➔ Chọn `▶ Mở Form Nhập Liệu (Cửa sổ giữa - Dialog)`.
3. **Mở Web App**:
   - Truy cập trực tiếp link Web App đã triển khai.
