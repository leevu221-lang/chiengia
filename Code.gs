/**
 * =========================================================================================
 * GOOGLE APPS SCRIPT: HỆ THỐNG NHẬP LIỆU KHÁCH HÀNG & BÁO CÁO TỔNG HỢP CHIẾN GIÁ
 * Giao diện: Web App / Sidebar / Dialog (Tone Xanh Lá Pastel)
 * Trang tính liên kết: Google Sheet (Sheet DATA & Sheet TỔNG HỢP)
 * =========================================================================================
 */

// Cấu hình ID và Link Trang Tính Google Sheet
const SPREADSHEET_ID = "1TBYhGWoe7cVwCx0oBV3d7uAPeFMza6KgsaW7NM9DTa0";
const SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/" + SPREADSHEET_ID + "/edit";

// Tên trang tính mặc định (hệ thống tự động tìm không phân biệt chữ hoa/thường)
const SHEET_DATA_NAME = "DATA";
const SHEET_TONG_HOP_NAME = "TỔNG HỢP";

// Bảng mã màu Tone Xanh Lá Pastel chuẩn thiết kế
const THEME = {
  HEADER_BG: "#d1fae5",       // Xanh ngọc pastel nhạt
  HEADER_TEXT: "#065f46",     // Xanh đậm tương phản cao
  ACCENT_BG: "#ecfdf5",       // Nền highlight xanh siêu nhẹ
  BORDER_COLOR: "#cbd5e1",    // Viền xám nhạt tinh tế
  TOTAL_BG: "#a7f3d0",        // Hàng tổng cộng nổi bật pastel
  TOTAL_TEXT: "#064e3b",      // Chữ hàng tổng cộng
  YES_BADGE_BG: "#dcfce7",    // Nhãn "Có" chiến giá
  YES_BADGE_TEXT: "#15803d",
  NO_BADGE_BG: "#f1f5f9",     // Nhãn "Không" chiến giá
  NO_BADGE_TEXT: "#64748b"
};

/**
 * 1. Hàm khởi tạo menu trên Google Sheets khi người dùng mở trang tính
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu("🌿 Quản Lý Nhập Liệu")
      .addItem("▶ Mở Form Nhập Liệu (Bên phải - Sidebar)", "showSidebar")
      .addItem("▶ Mở Form Nhập Liệu (Cửa sổ giữa - Dialog)", "showModalDialog")
      .addSeparator()
      .addItem("🔄 Cập Nhật Lại Bảng Tổng Hợp", "manualUpdateSummary")
      .addItem("🎨 Định Dạng Lại Bảng Tính (Pastel Style)", "formatSheetsManual")
      .addSeparator()
      .addItem("ℹ Hướng Dẫn & Thông Tin", "showHelp")
      .addToUi();
  } catch (e) {
    Logger.log("Chế độ chạy không hỗ trợ UI menu (Web App mode): " + e.toString());
  }
}

/**
 * 2. Mở giao diện dưới dạng Sidebar bên phải màn hình Google Sheet
 */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile("index")
    .setTitle("Nhập Liệu Khách Hàng")
    .setWidth(420);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * 3. Mở giao diện dưới dạng Hộp thoại (Modal Dialog) ở giữa màn hình
 */
function showModalDialog() {
  const html = HtmlService.createHtmlOutputFromFile("index")
    .setWidth(480)
    .setHeight(750);
  SpreadsheetApp.getUi().showModalDialog(html, "Nhập Liệu Khách Hàng");
}

/**
 * 4. Hàm phục vụ Web App độc lập khi người dùng truy cập qua URL Web App
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("Nhập Dữ Liệu Khách Hàng - Chiến Giá")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 5. Lấy cấu hình ban đầu gửi về cho giao diện (Frontend)
 */
function getAppConfig() {
  return {
    spreadsheetId: SPREADSHEET_ID,
    spreadsheetUrl: SPREADSHEET_URL,
    sheetDataName: SHEET_DATA_NAME,
    sheetTongHopName: SHEET_TONG_HOP_NAME
  };
}

/**
 * 6. Kết nối đến Google Spreadsheet một cách an toàn và linh hoạt
 */
function getSpreadsheet() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (err) {
    // Trường hợp chạy dưới dạng Web App độc lập
  }

  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
    return SpreadsheetApp.openById(SPREADSHEET_ID.trim());
  }
  throw new Error("Không thể kết nối đến Google Spreadsheet. Vui lòng kiểm tra lại SPREADSHEET_ID!");
}

/**
 * 7. Lấy sheet theo tên (không phân biệt chữ hoa/thường, tự động tạo nếu chưa có)
 */
function getOrCreateSheet(ss, sheetName) {
  const normalized = sheetName.trim().toLowerCase();
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().trim().toLowerCase() === normalized) {
      return sheets[i];
    }
  }
  // Nếu chưa có, tạo sheet mới
  return ss.insertSheet(sheetName);
}

/**
 * 8. Kiểm tra và định dạng hàng tiêu đề cho Sheet DATA
 */
function ensureDataSheetHeader(sheet) {
  const headers = [
    "STT",
    "THỜI GIAN",
    "NGÀY",
    "KHÁCH HÀNG",
    "SỐ ĐIỆN THOẠI",
    "SẢN PHẨM & LÝ DO RA VỀ",
    "NHÂN VIÊN PHỤ TRÁCH",
    "CHIẾN GIÁ"
  ];

  if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue().toString().trim() === "") {
    sheet.clear();
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    
    // Áp dụng định dạng Header tone pastel xanh lá
    headerRange
      .setBackground(THEME.HEADER_BG)
      .setFontColor(THEME.HEADER_TEXT)
      .setFontWeight("bold")
      .setFontFamily("Arial")
      .setFontSize(10)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle")
      .setWrap(true);
    
    sheet.setRowHeight(1, 40);
    sheet.setFrozenRows(1);

    // Cài đặt độ rộng cột tối ưu
    const colWidths = [60, 160, 110, 180, 140, 300, 170, 120];
    colWidths.forEach((w, idx) => sheet.setColumnWidth(idx + 1, w));
  }
}

/**
 * 9. Kiểm tra và định dạng hàng tiêu đề cho Sheet TỔNG HỢP
 */
function ensureSummarySheetHeader(sheet) {
  const headers = [
    "STT",
    "NGÀY",
    "NHÂN VIÊN PHỤ TRÁCH",
    "ĐƠN CHIẾN GIÁ",
    "ĐƠN KHÔNG CHIẾN GIÁ",
    "TỔNG SỐ ĐƠN",
    "TỶ LỆ CHIẾN GIÁ"
  ];

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  
  headerRange
    .setBackground(THEME.HEADER_BG)
    .setFontColor(THEME.HEADER_TEXT)
    .setFontWeight("bold")
    .setFontFamily("Arial")
    .setFontSize(10)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setWrap(true);

  sheet.setRowHeight(1, 40);
  sheet.setFrozenRows(1);

  const colWidths = [60, 120, 200, 150, 170, 130, 150];
  colWidths.forEach((w, idx) => sheet.setColumnWidth(idx + 1, w));
}

/**
 * 10. HÀM CHÍNH: Nhận thông tin từ Form, ghi vào Sheet DATA và làm mới Sheet TỔNG HỢP
 * @param {Object} formData - { khachHang, sdt, sanPham, nhanVien, chienGia }
 */
function saveCustomerData(formData) {
  // Sử dụng LockService chống xung đột ghi đè đồng thời
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(12000); // Đợi tối đa 12 giây
  } catch (err) {
    return {
      success: false,
      message: "Hệ thống đang bận ghi dữ liệu khác, xin vui lòng thử lại sau vài giây!"
    };
  }

  try {
    const ss = getSpreadsheet();
    const sheetData = getOrCreateSheet(ss, SHEET_DATA_NAME);
    
    // Đảm bảo tiêu đề cột có sẵn
    ensureDataSheetHeader(sheetData);

    // 1. Chuẩn hóa dữ liệu đầu vào
    const khachHang = (formData.khachHang || "").trim();
    if (!khachHang) {
      return { success: false, message: "Vui lòng nhập tên Khách hàng!" };
    }

    const sdtRaw = (formData.sdt || "").toString().trim().replace(/[\s.-]/g, "");
    if (!sdtRaw) {
      return { success: false, message: "Vui lòng nhập Số điện thoại!" };
    }
    // Giữ số 0 đầu bằng dấu nháy đơn
    const sdtFormatted = sdtRaw.startsWith("'") ? sdtRaw : `'${sdtRaw}`;

    const sanPham = (formData.sanPham || "").trim();
    const nhanVien = (formData.nhanVien || "").trim() || "Chưa phân công";
    const isChienGia = Boolean(formData.chienGia);
    const chienGiaText = isChienGia ? "Có" : "Không";

    // 2. Ngày giờ theo chuẩn Việt Nam (GMT+7)
    const now = new Date();
    const thoiGianStr = Utilities.formatDate(now, "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");
    const ngayStr = Utilities.formatDate(now, "Asia/Ho_Chi_Minh", "dd/MM/yyyy");

    // 3. Tính STT tự động dựa theo dòng cuối thực tế
    const lastRow = sheetData.getLastRow();
    const stt = lastRow >= 1 ? lastRow : 1;
    const targetRow = lastRow + 1;

    // 4. Mảng giá trị ghi vào Sheet DATA:
    // [STT, THỜI GIAN, NGÀY, KHÁCH HÀNG, SỐ ĐIỆN THOẠI, SẢN PHẨM & LÝ DO RA VỀ, NHÂN VIÊN PHỤ TRÁCH, CHIẾN GIÁ]
    const rowValues = [
      stt,
      thoiGianStr,
      ngayStr,
      khachHang,
      sdtFormatted,
      sanPham,
      nhanVien,
      chienGiaText
    ];

    sheetData.appendRow(rowValues);

    // 5. Định dạng dòng mới nhập
    sheetData.setRowHeight(targetRow, 32);
    const rowRange = sheetData.getRange(targetRow, 1, 1, 8);
    rowRange
      .setFontFamily("Arial")
      .setFontSize(10)
      .setVerticalAlignment("middle")
      .setBorder(true, true, true, true, true, true, THEME.BORDER_COLOR, SpreadsheetApp.BorderStyle.SOLID);

    // Căn giữa các cột: STT(1), Thời Gian(2), Ngày(3), SĐT(5), Nhân Viên(7), Chiến Giá(8)
    [1, 2, 3, 5, 7, 8].forEach(col => {
      sheetData.getRange(targetRow, col).setHorizontalAlignment("center");
    });
    // Căn trái: Khách Hàng(4), Sản Phẩm(6)
    [4, 6].forEach(col => {
      sheetData.getRange(targetRow, col).setHorizontalAlignment("left");
    });

    // Định dạng màu cho cột Chiến Giá
    const chienGiaCell = sheetData.getRange(targetRow, 8);
    if (isChienGia) {
      chienGiaCell
        .setBackground(THEME.YES_BADGE_BG)
        .setFontColor(THEME.YES_BADGE_TEXT)
        .setFontWeight("bold");
    } else {
      chienGiaCell
        .setBackground(THEME.NO_BADGE_BG)
        .setFontColor(THEME.NO_BADGE_TEXT)
        .setFontWeight("normal");
    }

    // 6. Tự động cập nhật lại Sheet TỔNG HỢP ngay lập tức
    updateSummarySheetInternal(ss);

    return {
      success: true,
      message: `Đã lưu thành công khách hàng #${stt}!`,
      data: {
        stt: stt,
        thoiGian: thoiGianStr,
        ngay: ngayStr,
        khachHang: khachHang,
        sdt: sdtRaw,
        sanPham: sanPham,
        nhanVien: nhanVien,
        chienGia: isChienGia,
        chienGiaText: chienGiaText
      }
    };

  } catch (error) {
    Logger.log("Lỗi khi lưu dữ liệu: " + error.toString());
    return {
      success: false,
      message: "Lỗi hệ thống khi lưu: " + error.toString()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 11. HÀM TỔNG HỢP: Gom nhóm theo Ngày + Nhân viên, đếm số đơn Chiến giá & Không chiến giá
 */
function updateSummarySheetInternal(ss) {
  if (!ss) ss = getSpreadsheet();
  
  const sheetData = getOrCreateSheet(ss, SHEET_DATA_NAME);
  const sheetSummary = getOrCreateSheet(ss, SHEET_TONG_HOP_NAME);

  // Đảm bảo tiêu đề cột
  ensureSummarySheetHeader(sheetSummary);

  const lastRowData = sheetData.getLastRow();
  // Xóa vùng dữ liệu cũ trong Sheet Tổng Hợp (từ dòng 2 trở đi)
  const lastRowSummary = sheetSummary.getLastRow();
  if (lastRowSummary > 1) {
    sheetSummary.getRange(2, 1, lastRowSummary - 1, 7).clear();
  }

  // Nếu không có dữ liệu nào trong sheet DATA
  if (lastRowData <= 1) {
    return;
  }

  // Lấy dữ liệu từ Sheet DATA: Cột 3 (Ngày), Cột 7 (Nhân Viên), Cột 8 (Chiến Giá)
  const dataValues = sheetData.getRange(2, 1, lastRowData - 1, 8).getValues();

  // Cấu trúc gom nhóm theo cặp (Ngày + Nhân Viên)
  // Map key: `${ngay}___${nhanVien}`
  const summaryMap = {};

  dataValues.forEach(row => {
    const ngay = (row[2] || "").toString().trim();
    const nhanVien = (row[6] || "").toString().trim() || "Chưa phân công";
    const chienGiaVal = (row[7] || "").toString().trim().toLowerCase();

    if (!ngay && !nhanVien) return;

    const key = `${ngay}___${nhanVien}`;
    if (!summaryMap[key]) {
      summaryMap[key] = {
        ngay: ngay,
        nhanVien: nhanVien,
        chienGia: 0,
        khongChienGia: 0,
        total: 0
      };
    }

    const isChienGia = (chienGiaVal === "có" || chienGiaVal === "true" || chienGiaVal === "co");
    if (isChienGia) {
      summaryMap[key].chienGia += 1;
    } else {
      summaryMap[key].khongChienGia += 1;
    }
    summaryMap[key].total += 1;
  });

  const keys = Object.keys(summaryMap);
  if (keys.length === 0) return;

  // Sắp xếp theo thứ tự ngày (mới nhất hoặc theo ngày tăng dần) và theo tên nhân viên
  keys.sort((a, b) => {
    const itemA = summaryMap[a];
    const itemB = summaryMap[b];

    // Chuyển đổi định dạng dd/MM/yyyy để so sánh thời gian
    const parseDate = (dStr) => {
      const parts = dStr.split("/");
      if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
      }
      return 0;
    };

    const timeA = parseDate(itemA.ngay);
    const timeB = parseDate(itemB.ngay);

    if (timeA !== timeB) {
      return timeB - timeA; // Ngày mới nhất lên trước
    }
    return itemA.nhanVien.localeCompare(itemB.nhanVien, "vi");
  });

  // Chuẩn bị mảng 2 chiều ghi vào sheet
  const outputRows = [];
  let totalAllChienGia = 0;
  let totalAllKhongChienGia = 0;
  let grandTotal = 0;

  keys.forEach((k, index) => {
    const item = summaryMap[k];
    const tyLe = item.total > 0 ? (item.chienGia / item.total) : 0;

    totalAllChienGia += item.chienGia;
    totalAllKhongChienGia += item.khongChienGia;
    grandTotal += item.total;

    outputRows.push([
      index + 1,
      item.ngay,
      item.nhanVien,
      item.chienGia,
      item.khongChienGia,
      item.total,
      tyLe
    ]);
  });

  // Thêm dòng TỔNG CỘNG ở cuối bảng
  const grandRatio = grandTotal > 0 ? (totalAllChienGia / grandTotal) : 0;
  outputRows.push([
    "TỔNG CỘNG",
    "-",
    "-",
    totalAllChienGia,
    totalAllKhongChienGia,
    grandTotal,
    grandRatio
  ]);

  // Ghi toàn bộ dữ liệu vào Sheet TỔNG HỢP
  const startRow = 2;
  const numRows = outputRows.length;
  const targetRange = sheetSummary.getRange(startRow, 1, numRows, 7);
  targetRange.setValues(outputRows);

  // Định dạng toàn bảng
  targetRange
    .setFontFamily("Arial")
    .setFontSize(10)
    .setVerticalAlignment("middle")
    .setBorder(true, true, true, true, true, true, THEME.BORDER_COLOR, SpreadsheetApp.BorderStyle.SOLID);

  for (let r = 0; r < numRows; r++) {
    sheetSummary.setRowHeight(startRow + r, 30);
  }

  // Căn lề: Cột STT(1), Ngày(2), Đơn Chiến Giá(4), Đơn Không Chiến Giá(5), Tổng Đơn(6), Tỷ Lệ(7) căn giữa
  sheetSummary.getRange(startRow, 1, numRows, 1).setHorizontalAlignment("center");
  sheetSummary.getRange(startRow, 2, numRows, 1).setHorizontalAlignment("center");
  sheetSummary.getRange(startRow, 3, numRows, 1).setHorizontalAlignment("left"); // Nhân viên căn trái
  sheetSummary.getRange(startRow, 4, numRows, 4).setHorizontalAlignment("center");

  // Định dạng % cho Cột 7 (Tỷ Lệ Chiến Giá)
  sheetSummary.getRange(startRow, 7, numRows, 1).setNumberFormat("0.0%");

  // Định dạng nổi bật dòng TỔNG CỘNG
  const totalRowIndex = startRow + numRows - 1;
  const totalRowRange = sheetSummary.getRange(totalRowIndex, 1, 1, 7);
  totalRowRange
    .setFontWeight("bold")
    .setBackground(THEME.TOTAL_BG)
    .setFontColor(THEME.TOTAL_TEXT);
  
  // Viền đôi dưới dòng tổng cộng
  totalRowRange.setBorder(true, true, true, true, true, true, THEME.TOTAL_TEXT, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}

/**
 * 12. Hàm người dùng bấm từ Menu để tự cập nhật bảng tổng hợp
 */
function manualUpdateSummary() {
  const ss = getSpreadsheet();
  updateSummarySheetInternal(ss);
  SpreadsheetApp.getUi().alert("Thông Báo", "✅ Đã cập nhật thành công Bảng Tổng Hợp Chiến Giá!", SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * 13. Hàm định dạng lại giao diện cả 2 sheet theo chuẩn Pastel
 */
function formatSheetsManual() {
  const ss = getSpreadsheet();
  const sheetData = getOrCreateSheet(ss, SHEET_DATA_NAME);
  const sheetSummary = getOrCreateSheet(ss, SHEET_TONG_HOP_NAME);

  ensureDataSheetHeader(sheetData);
  ensureSummarySheetHeader(sheetSummary);
  updateSummarySheetInternal(ss);

  SpreadsheetApp.getUi().alert("Thông Báo", "✨ Đã định dạng lại bảng tính theo tone xanh pastel thành công!", SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * 14. Hộp thoại Hướng dẫn sử dụng
 */
function showHelp() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    "🌿 HƯỚNG DẪN SỬ DỤNG FORM NHẬP LIỆU CHIẾN GIÁ",
    "1. Mở Form từ thanh menu 'Quản Lý Nhập Liệu' hoặc truy cập qua liên kết Web App.\n" +
    "2. Điền Khách Hàng, SĐT, Sản Phẩm & Mã Nhân Viên.\n" +
    "3. Tích chọn ô 'Chiến Giá' nếu đơn có thương lượng/chiến giá (mặc định là Không).\n" +
    "4. Nhấn 'Lưu Thông Tin' hoặc dùng phím tắt Enter / Ctrl+Enter để lưu.\n" +
    "5. Dữ liệu sẽ lập tức lưu vào sheet 'DATA' và tự động tổng hợp số lượng sang sheet 'TỔNG HỢP'.",
    ui.ButtonSet.OK
  );
}
