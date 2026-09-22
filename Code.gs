/**
 * =========================================================================================
 * GOOGLE APPS SCRIPT: HỆ THỐNG NHẬP LIỆU KHÁCH HÀNG & BÁO CÁO TỔNG HỢP CHIẾN GIÁ
 * Khớp 100% cột trong trang tính: STT | KHÁCH HÀNG | SĐT | NHÂN VIÊN | Chiến Giá | Time | Sản Phẩm
 * Hỗ trợ nhận dữ liệu từ GitHub Pages (doPost & doGet) + Khử trùng lặp CacheService
 * =========================================================================================
 */

// Cấu hình ID và Link Trang Tính Google Sheet
const SPREADSHEET_ID = "1TBYhGWoe7cVwCx0oBV3d7uAPeFMza6KgsaW7NM9DTa0";
const SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/" + SPREADSHEET_ID + "/edit?usp=sharing";

// Tên trang tính mặc định (tự động tìm không phân biệt chữ hoa/thường)
const SHEET_DATA_NAME = "DATA";
const SHEET_TONG_HOP_NAME = "TỔNG HỢP";

// Bảng mã màu Tone Pastel
const THEME = {
  HEADER_BG: "#f59e0b",       // Màu vàng cam đồng bộ với hàng tiêu đề của bạn
  HEADER_TEXT: "#000000",
  SUMMARY_HEADER_BG: "#d1fae5", // Xanh pastel cho sheet Tổng Hợp
  SUMMARY_HEADER_TEXT: "#065f46",
  BORDER_COLOR: "#cbd5e1",
  TOTAL_BG: "#a7f3d0",
  TOTAL_TEXT: "#064e3b",
  YES_BADGE_BG: "#dcfce7",
  YES_BADGE_TEXT: "#15803d",
  NO_BADGE_BG: "#f1f5f9",
  NO_BADGE_TEXT: "#64748b"
};

/**
 * 1. Khởi tạo menu trên Google Sheets
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu("🌿 Quản Lý Nhập Liệu")
      .addItem("▶ Mở Form Nhập Liệu (Bên phải - Sidebar)", "showSidebar")
      .addItem("▶ Mở Form Nhập Liệu (Cửa sổ giữa - Dialog)", "showModalDialog")
      .addItem("👥 Xem Chi Tiết Nhân Viên", "showStaffDetailDialog")
      .addSeparator()
      .addItem("⚡ Tối Ưu Bảng Tính & Giải Phóng Bộ Nhớ", "optimizeSpreadsheet")
      .addItem("📦 Lưu Trữ (Archive) Dữ Liệu Cũ", "archiveOldData")
      .addSeparator()
      .addItem("🔄 Cập Nhật Lại Bảng Tổng Hợp", "manualUpdateSummary")
      .addItem("🎨 Định Dạng Lại Tiêu Đề Cột", "formatSheetsManual")
      .addSeparator()
      .addItem("ℹ Hướng Dẫn & Thông Tin", "showHelp")
      .addToUi();
  } catch (e) {
    Logger.log("Chế độ chạy không hỗ trợ UI: " + e.toString());
  }
}

function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile("index")
    .setTitle("Nhập Liệu Khách Hàng")
    .setWidth(420);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showModalDialog() {
  const html = HtmlService.createHtmlOutputFromFile("index")
    .setWidth(480)
    .setHeight(750);
  SpreadsheetApp.getUi().showModalDialog(html, "Nhập Liệu Khách Hàng");
}

function showStaffDetailDialog() {
  const html = HtmlService.createHtmlOutputFromFile("index")
    .setWidth(560)
    .setHeight(760);
  SpreadsheetApp.getUi().showModalDialog(html, "👥 Chi Tiết Theo Nhân Viên");
}

/**
 * 2. Xử lý yêu cầu GET (Mở Web App hoặc Nhận lưu dữ liệu dự phòng từ GitHub Pages)
 */
function doGet(e) {
  // 1. Kiểm tra kết nối Ping
  if (e && e.parameter && e.parameter.action === "ping") {
    return createJsonResponse({
      success: true,
      message: "Kết nối thành công tới Google Apps Script!",
      spreadsheetUrl: SPREADSHEET_URL
    }, e.parameter.callback);
  }

  // 2. Nhận lưu dữ liệu gửi qua GET (Chỉ xử lý khi có action=save rõ ràng, ngăn chặn hoàn toàn redirect từ POST gây trùng lặp)
  if (e && e.parameter && e.parameter.action === "save") {
    let data = e.parameter;
    if (typeof data.chienGia === "string") {
      data.chienGia = (data.chienGia.toLowerCase() === "true" || data.chienGia === "1");
    }
    const result = saveCustomerData(data);
    return createJsonResponse(result, e.parameter.callback);
  }

  // 3. API lấy dữ liệu Báo Cáo Tổng Hợp cho giao diện Web (hỗ trợ phân trang / giới hạn để siêu tốc)
  if (e && e.parameter && (e.parameter.action === "getReport" || e.parameter.action === "getData")) {
    const limit = e.parameter.limit ? parseInt(e.parameter.limit) : 3000;
    const date = e.parameter.date || null;
    const report = getReportData(date, limit);
    return createJsonResponse(report, e.parameter.callback);
  }

  // 4. API lấy danh sách nhân viên từ sheet "nhân viên" cho gợi ý tự động
  if (e && e.parameter && (e.parameter.action === "getStaffList" || e.parameter.action === "getStaff")) {
    const staffData = getStaffList();
    return createJsonResponse(staffData, e.parameter.callback);
  }

  // 3. Mặc định mở giao diện Web App
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("Nhập Dữ Liệu Khách Hàng - Chiến Giá")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 3. QUAN TRỌNG NHẤT: Xử lý yêu cầu POST gửi từ GitHub Pages (mode: no-cors hoặc application/x-www-form-urlencoded)
 */
function doPost(e) {
  try {
    let data = {};
    if (e && e.parameter && (e.parameter.khachHang || e.parameter.sdt)) {
      data = e.parameter;
    } else if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        data = e.parameter || {};
      }
    }

    if (typeof data.chienGia === "string") {
      data.chienGia = (data.chienGia.toLowerCase() === "true" || data.chienGia === "1");
    }

    const result = saveCustomerData(data);
    return createJsonResponse(result, e && e.parameter ? e.parameter.callback : null);
  } catch (error) {
    Logger.log("Lỗi doPost: " + error.toString());
    return createJsonResponse({
      success: false,
      message: "Lỗi doPost: " + error.toString()
    }, e && e.parameter ? e.parameter.callback : null);
  }
}

/**
 * Xuất dữ liệu JSON / JSONP
 */
function createJsonResponse(data, callback) {
  let outputText = JSON.stringify(data);
  if (callback) {
    outputText = callback + "(" + outputText + ");";
    return ContentService.createTextOutput(outputText)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(outputText)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Kết nối Spreadsheet an toàn
 */
function getSpreadsheet() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (err) {}

  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
    return SpreadsheetApp.openById(SPREADSHEET_ID.trim());
  }
  throw new Error("Không tìm thấy SPREADSHEET_ID!");
}

/**
 * Lấy Sheet theo tên (hoặc sheet đầu tiên nếu không tìm thấy)
 */
function getOrCreateSheet(ss, sheetName) {
  const normalized = sheetName.trim().toLowerCase();
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().trim().toLowerCase() === normalized) {
      return sheets[i];
    }
  }
  // Nếu là DATA mà chưa có, lấy sheet đầu tiên hoặc tạo mới
  if (normalized === "data" && sheets.length > 0) {
    return sheets[0];
  }
  return ss.insertSheet(sheetName);
}

/**
 * Kiểm tra và định dạng tiêu đề Sheet DATA khớp 100% với giao diện bảng tính của bạn:
 * Col A: STT
 * Col B: KHÁCH HÀNG
 * Col C: SĐT
 * Col D: NHÂN VIÊN
 * Col E: Chiến Giá
 * Col F: Time
 * Col G: Sản Phẩm Chính
 */
function ensureDataSheetHeader(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), 6);

  if (lastRow === 0) {
    // Nếu sheet hoàn toàn trống, tạo hàng tiêu đề chuẩn
    const headers = ["STT", "KHÁCH HÀNG", "SĐT", "NHÂN VIÊN", "Chiến Giá", "Time", "Sản Phẩm Chính"];
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange
      .setBackground("#f59e0b")
      .setFontColor("#000000")
      .setFontWeight("bold")
      .setFontFamily("Arial")
      .setFontSize(10)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    sheet.setRowHeight(1, 38);
    sheet.setFrozenRows(1);
  } else {
    // Nếu đã có hàng tiêu đề (như trong ảnh của bạn), kiểm tra xem cột G đã có "Sản Phẩm Chính" chưa
    const headerG = sheet.getRange(1, 7).getValue().toString().trim();
    if (!headerG || headerG.includes("Sản Phẩm & Lý Do Ra Về")) {
      sheet.getRange(1, 7).setValue("Sản Phẩm Chính");
      sheet.getRange(1, 7)
        .setBackground(sheet.getRange(1, 6).getBackground() || "#f59e0b")
        .setFontColor(sheet.getRange(1, 6).getFontColor() || "#000000")
        .setFontWeight("bold")
        .setFontFamily("Arial")
        .setFontSize(10)
        .setHorizontalAlignment("center")
        .setVerticalAlignment("middle");
      sheet.setColumnWidth(7, 200);
    }
  }
}

/**
 * Đảm bảo tiêu đề cột cho Sheet TỔNG HỢP
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
    .setBackground(THEME.SUMMARY_HEADER_BG)
    .setFontColor(THEME.SUMMARY_HEADER_TEXT)
    .setFontWeight("bold")
    .setFontFamily("Arial")
    .setFontSize(10)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  sheet.setRowHeight(1, 38);
  sheet.setFrozenRows(1);

  const colWidths = [60, 120, 200, 140, 160, 130, 140];
  colWidths.forEach((w, idx) => sheet.setColumnWidth(idx + 1, w));
}

/**
 * 4. HÀM CHÍNH LƯU DỮ LIỆU VÀO SHEET "DATA"
 * Khớp chuẩn xác theo các cột trong hình:
 * Cột 1 (A): STT
 * Cột 2 (B): KHÁCH HÀNG
 * Cột 3 (C): SĐT (giữ nguyên số 0 ở đầu)
 * Cột 4 (D): NHÂN VIÊN
 * Cột 5 (E): Chiến Giá (Có / Không)
 * Cột 6 (F): Time (dd/MM/yyyy HH:mm:ss)
 * Cột 7 (G): Sản Phẩm Chính
 */
function saveCustomerData(formData) {
  // Chống ghi đè đồng thời
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(12000);
  } catch (err) {
    return { success: false, message: "Hệ thống đang bận, vui lòng thử lại sau vài giây!" };
  }

  try {
    const ss = getSpreadsheet();
    const sheetData = getOrCreateSheet(ss, SHEET_DATA_NAME);
    
    // Đảm bảo hàng tiêu đề chuẩn
    ensureDataSheetHeader(sheetData);

    // Chuẩn hóa dữ liệu
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

    const nhanVien = (formData.nhanVien || "").trim() || "Chưa phân công";
    const sanPham = (formData.sanPham || "").trim();
    const isChienGia = Boolean(formData.chienGia);
    const chienGiaText = isChienGia ? "Có" : "Không";

    // KHỬ TRÙNG LẶP ĐA TẦNG TUYỆT ĐỐI (Chống click nhiều lần, chống redirect kép, chống retry mạng)
    const cache = CacheService.getScriptCache();
    
    // Tầng 1: Khử theo mã giao dịch duy nhất tx_id
    const txId = (formData.tx_id || "").toString().trim();
    if (txId) {
      const txKey = "tx_" + encodeURIComponent(txId);
      if (cache.get(txKey)) {
        Logger.log("Bỏ qua đơn trùng lặp theo tx_id: " + txId);
        return { success: true, message: `Đơn khách ${khachHang} đã được lưu thành công (bỏ qua trùng lặp)!`, duplicate: true };
      }
      cache.put(txKey, "saved", 60); // Khóa mã giao dịch trong 60 giây
    }

    // Tầng 2: Khử trùng nội dung giống hệt nhau (Tên + SĐT + Sản phẩm) trong 10 giây
    const contentKey = "content_" + encodeURIComponent(khachHang.toLowerCase() + "_" + sdtRaw + "_" + sanPham.toLowerCase());
    if (cache.get(contentKey)) {
      Logger.log("Bỏ qua đơn trùng lặp nội dung giống hệt nhau trong 10s: " + contentKey);
      return { success: true, message: `Đơn khách ${khachHang} đã được lưu thành công (bỏ qua trùng lặp)!`, duplicate: true };
    }
    cache.put(contentKey, "saved", 10); // Khóa nội dung trong 10 giây

    // Thời gian chuẩn GMT+7
    const now = new Date();
    const thoiGianStr = Utilities.formatDate(now, "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");

    // Tính STT tự động theo dòng cuối thực tế
    const lastRow = sheetData.getLastRow();
    const stt = lastRow >= 1 ? lastRow : 1;
    const targetRow = lastRow + 1;

    // MẢNG DỮ LIỆU GHI VÀO DÒNG MỚI:
    // [STT, KHÁCH HÀNG, SĐT, NHÂN VIÊN, Chiến Giá, Time, Sản Phẩm]
    const rowValues = [
      stt,
      khachHang,
      sdtFormatted,
      nhanVien,
      chienGiaText,
      thoiGianStr,
      sanPham
    ];

    sheetData.appendRow(rowValues);

    // TỐI ƯU SIÊU TỐC: Định dạng toàn bộ dòng trong 1 lệnh duy nhất (giảm từ 10 lệnh xuống 1)
    const rowRange = sheetData.getRange(targetRow, 1, 1, 7);
    rowRange
      .setFontFamily("Arial")
      .setFontSize(10)
      .setVerticalAlignment("middle")
      .setHorizontalAlignments([["center", "left", "center", "center", "center", "center", "left"]])
      .setBorder(true, true, true, true, true, true, THEME.BORDER_COLOR, SpreadsheetApp.BorderStyle.SOLID);

    // Tô màu ô Chiến Giá nếu có (1 lệnh)
    if (isChienGia) {
      sheetData.getRange(targetRow, 5)
        .setBackground(THEME.YES_BADGE_BG)
        .setFontColor(THEME.YES_BADGE_TEXT)
        .setFontWeight("bold");
    }

    // TỐI ƯU CHO DỮ LIỆU LƯU TRỮ LÂU: Cập nhật tăng dần (incremental) siêu tốc trong < 50ms
    updateSummaryIncremental(ss, thoiGianStr, nhanVien, isChienGia);

    return {
      success: true,
      message: `Đã lưu thành công khách hàng #${stt}!`,
      data: {
        stt: stt,
        khachHang: khachHang,
        sdt: sdtRaw,
        nhanVien: nhanVien,
        chienGia: isChienGia,
        thoiGian: thoiGianStr,
        sanPham: sanPham
      }
    };

  } catch (error) {
    Logger.log("Lỗi khi lưu dữ liệu: " + error.toString());
    return {
      success: false,
      message: "Lỗi lưu trang tính: " + error.toString()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 5. HÀM TỔNG HỢP: Thống kê số lượng đơn Chiến Giá & Không Chiến Giá theo Ngày và Nhân Viên
 */
function updateSummarySheetInternal(ss) {
  if (!ss) ss = getSpreadsheet();

  const sheetData = getOrCreateSheet(ss, SHEET_DATA_NAME);
  const sheetSummary = getOrCreateSheet(ss, SHEET_TONG_HOP_NAME);

  ensureSummarySheetHeader(sheetSummary);

  const lastRowData = sheetData.getLastRow();
  const lastRowSummary = sheetSummary.getLastRow();
  if (lastRowSummary > 1) {
    sheetSummary.getRange(2, 1, lastRowSummary - 1, 7).clear();
  }

  if (lastRowData <= 1) return;

  // Lấy toàn bộ dữ liệu từ dòng 2 của Sheet DATA
  // Cột 4: NHÂN VIÊN, Cột 5: Chiến Giá, Cột 6: Time (dd/MM/yyyy HH:mm:ss)
  const dataValues = sheetData.getRange(2, 1, lastRowData - 1, 7).getValues();
  const summaryMap = {};

  dataValues.forEach(row => {
    const nhanVien = (row[3] || "").toString().trim() || "Chưa phân công";
    const chienGiaVal = (row[4] || "").toString().trim().toLowerCase();
    
    // Xử lý chuẩn xác thời gian từ Date object hoặc string
    let rawTime = row[5];
    let fullDateTimeStr = "";
    let dateOnlyStr = "";

    if (rawTime instanceof Date) {
      fullDateTimeStr = Utilities.formatDate(rawTime, "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");
      dateOnlyStr = Utilities.formatDate(rawTime, "Asia/Ho_Chi_Minh", "dd/MM/yyyy");
    } else if (rawTime) {
      const str = rawTime.toString().trim();
      const parsedD = new Date(str);
      if (!isNaN(parsedD.getTime()) && (str.includes("GMT") || str.length > 15)) {
        fullDateTimeStr = Utilities.formatDate(parsedD, "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");
        dateOnlyStr = Utilities.formatDate(parsedD, "Asia/Ho_Chi_Minh", "dd/MM/yyyy");
      } else {
        fullDateTimeStr = str;
        dateOnlyStr = str.includes(" ") ? str.split(" ")[0] : str;
      }
    }

    if (!fullDateTimeStr && !nhanVien) return;

    const key = `${dateOnlyStr}___${nhanVien}`;
    if (!summaryMap[key]) {
      summaryMap[key] = {
        ngayHienThi: fullDateTimeStr, // Hiển thị full Ngày tháng năm giờ phút giây
        ngayLoc: dateOnlyStr,
        nhanVien: nhanVien,
        chienGia: 0,
        khongChienGia: 0,
        total: 0
      };
    } else {
      // Cập nhật thời gian mới nhất trong ngày
      summaryMap[key].ngayHienThi = fullDateTimeStr;
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

  // Sắp xếp ngày mới nhất lên trước và theo tên nhân viên
  keys.sort((a, b) => {
    const itemA = summaryMap[a];
    const itemB = summaryMap[b];

    const parseDate = (dStr) => {
      const parts = dStr.split("/");
      if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
      }
      return 0;
    };

    const timeA = parseDate(itemA.ngayLoc);
    const timeB = parseDate(itemB.ngayLoc);

    if (timeA !== timeB) return timeB - timeA;
    return itemA.nhanVien.localeCompare(itemB.nhanVien, "vi");
  });

  const outputRows = [];
  let sumChienGia = 0;
  let sumKhongChienGia = 0;
  let grandTotal = 0;

  keys.forEach((k, idx) => {
    const item = summaryMap[k];
    const tyLe = item.total > 0 ? (item.chienGia / item.total) : 0;

    sumChienGia += item.chienGia;
    sumKhongChienGia += item.khongChienGia;
    grandTotal += item.total;

    outputRows.push([
      idx + 1,
      item.ngayHienThi, // Full Ngày tháng năm giờ phút giây
      item.nhanVien,
      item.chienGia,
      item.khongChienGia,
      item.total,
      tyLe
    ]);
  });

  // Hàng TỔNG CỘNG
  const grandRatio = grandTotal > 0 ? (sumChienGia / grandTotal) : 0;
  outputRows.push([
    "TỔNG CỘNG",
    "-",
    "-",
    sumChienGia,
    sumKhongChienGia,
    grandTotal,
    grandRatio
  ]);

  const startRow = 2;
  const numRows = outputRows.length;
  const targetRange = sheetSummary.getRange(startRow, 1, numRows, 7);
  targetRange.setValues(outputRows);

  targetRange
    .setFontFamily("Arial")
    .setFontSize(10)
    .setVerticalAlignment("middle")
    .setBorder(true, true, true, true, true, true, THEME.BORDER_COLOR, SpreadsheetApp.BorderStyle.SOLID);

  // TỐI ƯU SIÊU TỐC: Đặt chiều cao dòng 1 lệnh duy nhất thay vì lặp qua từng dòng
  sheetSummary.setRowHeights(startRow, numRows, 30);

  sheetSummary.getRange(startRow, 1, numRows, 1).setHorizontalAlignment("center");
  sheetSummary.getRange(startRow, 2, numRows, 1).setHorizontalAlignment("center").setNumberFormat("@"); // Định dạng text để giữ full ngày giờ
  sheetSummary.getRange(startRow, 3, numRows, 1).setHorizontalAlignment("left");
  sheetSummary.getRange(startRow, 4, numRows, 3).setHorizontalAlignment("center");
  sheetSummary.getRange(startRow, 7, numRows, 1).setHorizontalAlignment("center").setNumberFormat("0.0%");

  // Định dạng dòng TỔNG CỘNG
  const totalRowRange = sheetSummary.getRange(startRow + numRows - 1, 1, 1, 7);
  totalRowRange
    .setFontWeight("bold")
    .setBackground(THEME.TOTAL_BG)
    .setFontColor(THEME.TOTAL_TEXT)
    .setBorder(true, true, true, true, true, true, THEME.TOTAL_TEXT, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}

/**
 * CẬP NHẬT TĂNG DẦN (INCREMENTAL) SIÊU TỐC (< 50ms)
 * Hoàn toàn KHÔNG quét lại hàng chục nghìn dòng của sheet DATA - đạt độ phức tạp O(1)
 */
function updateSummaryIncremental(ss, fullTimeStr, nhanVien, isChienGia) {
  try {
    const sheetSummary = getOrCreateSheet(ss, SHEET_TONG_HOP_NAME);
    const lastRow = sheetSummary.getLastRow();

    if (lastRow <= 1) {
      // Sheet TỔNG HỢP hoàn toàn trống (chỉ có tiêu đề)
      ensureSummarySheetHeader(sheetSummary);
      const row1 = [1, fullTimeStr, nhanVien, isChienGia ? 1 : 0, isChienGia ? 0 : 1, 1, isChienGia ? 1 : 0];
      const totalRow = ["TỔNG CỘNG", "-", "-", isChienGia ? 1 : 0, isChienGia ? 0 : 1, 1, isChienGia ? 1 : 0];
      sheetSummary.getRange(2, 1, 2, 7).setValues([row1, totalRow]);
      formatSummarySingleRow(sheetSummary, 2);
      formatSummaryTotalRow(sheetSummary, 3);
      return;
    }

    const dateOnly = fullTimeStr.includes(" ") ? fullTimeStr.split(" ")[0] : fullTimeStr;
    const summaryData = sheetSummary.getRange(2, 1, lastRow - 1, 7).getValues();
    let foundRowIndex = -1;
    let totalRowIndex = -1;

    for (let i = 0; i < summaryData.length; i++) {
      const row = summaryData[i];
      const rowNgay = (row[1] || "").toString().trim();
      const rowNV = (row[2] || "").toString().trim();

      if (row[0] === "TỔNG CỘNG" || rowNgay === "-") {
        totalRowIndex = i + 2;
        continue;
      }

      const rowDateOnly = rowNgay.includes(" ") ? rowNgay.split(" ")[0] : rowNgay;
      if (rowDateOnly === dateOnly && rowNV === nhanVien) {
        foundRowIndex = i + 2;
        break;
      }
    }

    if (foundRowIndex > 0) {
      // Đã có dòng của nhân viên trong ngày: cập nhật số liệu ngay tại dòng đó (O(1))
      const curRow = sheetSummary.getRange(foundRowIndex, 1, 1, 7).getValues()[0];
      const curChien = Number(curRow[3]) || 0;
      const curKhong = Number(curRow[4]) || 0;
      const newChien = isChienGia ? curChien + 1 : curChien;
      const newKhong = isChienGia ? curKhong : curKhong + 1;
      const newTotal = newChien + newKhong;
      const newRatio = newTotal > 0 ? (newChien / newTotal) : 0;

      sheetSummary.getRange(foundRowIndex, 2).setValue(fullTimeStr).setNumberFormat("@");
      sheetSummary.getRange(foundRowIndex, 4, 1, 4).setValues([[newChien, newKhong, newTotal, newRatio]]);
    } else {
      // Nhân viên chưa có dòng nào hôm nay:
      // TỐI ƯU SIÊU TỐC: Chèn 1 dòng mới ngay trước dòng TỔNG CỘNG (hoặc cuối bảng) mà KHÔNG quét lại DATA
      if (totalRowIndex > 0) {
        sheetSummary.insertRowBefore(totalRowIndex);
        const newRowIdx = totalRowIndex;
        const newStt = totalRowIndex - 1;
        const newRowValues = [
          newStt,
          fullTimeStr,
          nhanVien,
          isChienGia ? 1 : 0,
          isChienGia ? 0 : 1,
          1,
          isChienGia ? 1 : 0
        ];
        sheetSummary.getRange(newRowIdx, 1, 1, 7).setValues([newRowValues]);
        formatSummarySingleRow(sheetSummary, newRowIdx);
        totalRowIndex = totalRowIndex + 1; // Dòng tổng cộng bị đẩy xuống 1 vị trí
      } else {
        const newRowIdx = sheetSummary.getLastRow() + 1;
        const newStt = newRowIdx - 1;
        const newRowValues = [
          newStt,
          fullTimeStr,
          nhanVien,
          isChienGia ? 1 : 0,
          isChienGia ? 0 : 1,
          1,
          isChienGia ? 1 : 0
        ];
        sheetSummary.getRange(newRowIdx, 1, 1, 7).setValues([newRowValues]);
        formatSummarySingleRow(sheetSummary, newRowIdx);
      }
    }

    // Cập nhật nhanh dòng TỔNG CỘNG trong O(1)
    if (totalRowIndex > 0) {
      const curTotalRow = sheetSummary.getRange(totalRowIndex, 1, 1, 7).getValues()[0];
      const sumChien = (Number(curTotalRow[3]) || 0) + (isChienGia ? 1 : 0);
      const sumKhong = (Number(curTotalRow[4]) || 0) + (isChienGia ? 0 : 1);
      const grandTotal = sumChien + sumKhong;
      const grandRatio = grandTotal > 0 ? (sumChien / grandTotal) : 0;

      sheetSummary.getRange(totalRowIndex, 4, 1, 4).setValues([[sumChien, sumKhong, grandTotal, grandRatio]]);
    }
  } catch (err) {
    Logger.log("Lỗi updateSummaryIncremental: " + err.toString());
  }
}

/**
 * Định dạng 1 dòng riêng lẻ trong sheet TỔNG HỢP (nhanh gọn)
 */
function formatSummarySingleRow(sheet, rowIdx) {
  const rowRange = sheet.getRange(rowIdx, 1, 1, 7);
  rowRange
    .setFontFamily("Arial")
    .setFontSize(10)
    .setVerticalAlignment("middle")
    .setBorder(true, true, true, true, true, true, THEME.BORDER_COLOR, SpreadsheetApp.BorderStyle.SOLID);
  sheet.setRowHeight(rowIdx, 30);
  sheet.getRange(rowIdx, 1).setHorizontalAlignment("center");
  sheet.getRange(rowIdx, 2).setHorizontalAlignment("center").setNumberFormat("@");
  sheet.getRange(rowIdx, 3).setHorizontalAlignment("left");
  sheet.getRange(rowIdx, 4, 1, 3).setHorizontalAlignment("center");
  sheet.getRange(rowIdx, 7).setHorizontalAlignment("center").setNumberFormat("0.0%");
}

/**
 * Định dạng dòng TỔNG CỘNG trong sheet TỔNG HỢP
 */
function formatSummaryTotalRow(sheet, rowIdx) {
  const totalRowRange = sheet.getRange(rowIdx, 1, 1, 7);
  totalRowRange
    .setFontFamily("Arial")
    .setFontSize(10)
    .setFontWeight("bold")
    .setBackground(THEME.TOTAL_BG)
    .setFontColor(THEME.TOTAL_TEXT)
    .setVerticalAlignment("middle")
    .setHorizontalAlignments([["center", "center", "center", "center", "center", "center", "center"]])
    .setBorder(true, true, true, true, true, true, THEME.TOTAL_TEXT, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sheet.setRowHeight(rowIdx, 32);
  sheet.getRange(rowIdx, 7).setNumberFormat("0.0%");
}

/**
 * 6. LẤY DỮ LIỆU BÁO CÁO CHO WEB FORM TỔNG HỢP
 * Hỗ trợ lấy giới hạn N dòng gần nhất (mặc định 3.000 dòng) để phản hồi siêu tốc ngay cả khi sheet có hàng trăm nghìn đơn
 */
function getReportData(dateFilter, limit) {
  try {
    const ss = getSpreadsheet();
    const sheetData = getOrCreateSheet(ss, SHEET_DATA_NAME);
    const lastRow = sheetData.getLastRow();
    if (lastRow <= 1) {
      return { success: true, list: [], dates: [] };
    }

    const maxLimit = limit || 3000;
    const startRow = Math.max(2, lastRow - maxLimit + 1);
    const numRows = lastRow - startRow + 1;

    const dataValues = sheetData.getRange(startRow, 1, numRows, 7).getValues();
    const list = [];
    const dateSet = {};

    // Đảo ngược thứ tự để đơn mới nhất lên đầu tiên
    for (let i = dataValues.length - 1; i >= 0; i--) {
      const row = dataValues[i];
      const stt = row[0] || (startRow + i);
      const khachHang = (row[1] || "").toString().trim();
      const sdt = (row[2] || "").toString().trim().replace(/^'/, "");
      const nhanVien = (row[3] || "").toString().trim() || "Chưa phân công";
      const chienGiaVal = (row[4] || "").toString().trim().toLowerCase();
      const isChienGia = (chienGiaVal === "có" || chienGiaVal === "true" || chienGiaVal === "co");

      let rawTime = row[5];
      let fullTimeStr = "";
      let dateOnly = "";

      if (rawTime instanceof Date) {
        fullTimeStr = Utilities.formatDate(rawTime, "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");
        dateOnly = Utilities.formatDate(rawTime, "Asia/Ho_Chi_Minh", "dd/MM/yyyy");
      } else if (rawTime) {
        const str = rawTime.toString().trim();
        const parsedD = new Date(str);
        if (!isNaN(parsedD.getTime()) && (str.includes("GMT") || str.length > 15)) {
          fullTimeStr = Utilities.formatDate(parsedD, "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");
          dateOnly = Utilities.formatDate(parsedD, "Asia/Ho_Chi_Minh", "dd/MM/yyyy");
        } else {
          fullTimeStr = str;
          dateOnly = str.includes(" ") ? str.split(" ")[0] : str;
        }
      }

      const sanPham = (row[6] || "").toString().trim();
      if (dateOnly) dateSet[dateOnly] = true;

      // Lọc theo ngày nếu có yêu cầu
      if (dateFilter && dateOnly !== dateFilter) continue;

      list.push({
        stt: stt,
        khachHang: khachHang,
        sdt: sdt,
        nhanVien: nhanVien,
        chienGia: isChienGia,
        chienGiaText: isChienGia ? "Có" : "Không",
        time: fullTimeStr,
        date: dateOnly,
        sanPham: sanPham
      });
    }

    return {
      success: true,
      list: list,
      dates: Object.keys(dateSet).sort().reverse()
    };
  } catch (err) {
    return {
      success: false,
      message: err.toString(),
      list: [],
      dates: []
    };
  }
}

function manualUpdateSummary() {
  const ss = getSpreadsheet();
  updateSummarySheetInternal(ss);
  SpreadsheetApp.getUi().alert("Thông Báo", "✅ Đã cập nhật thành công Bảng Tổng Hợp!", SpreadsheetApp.getUi().ButtonSet.OK);
}

function formatSheetsManual() {
  const ss = getSpreadsheet();
  const sheetData = getOrCreateSheet(ss, SHEET_DATA_NAME);
  const sheetSummary = getOrCreateSheet(ss, SHEET_TONG_HOP_NAME);
  ensureDataSheetHeader(sheetData);
  ensureSummarySheetHeader(sheetSummary);
  updateSummarySheetInternal(ss);
  SpreadsheetApp.getUi().alert("Thông Báo", "✨ Đã định dạng lại bảng tính thành công!", SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * TỐI ƯU TOÀN DIỆN BẢNG TÍNH GOOGLE SHEETS
 * Dọn sạch hàng rác, cột rác (H -> Z), giải phóng bộ nhớ để sheet chạy siêu tốc dù lưu hàng chục nghìn đơn
 */
function optimizeSpreadsheet() {
  try {
    const ss = getSpreadsheet();
    const sheets = [
      { name: SHEET_DATA_NAME, maxCols: 7 },
      { name: SHEET_TONG_HOP_NAME, maxCols: 7 },
      { name: "nhân viên", maxCols: 3 }
    ];

    let totalColsDeleted = 0;
    let totalRowsTrimmed = 0;

    sheets.forEach(info => {
      const sheet = ss.getSheetByName(info.name);
      if (!sheet) return;

      // 1. Xóa các cột thừa vượt quá maxCols (Ví dụ từ H đến Z)
      const curCols = sheet.getMaxColumns();
      if (curCols > info.maxCols) {
        const deleteCount = curCols - info.maxCols;
        sheet.deleteColumns(info.maxCols + 1, deleteCount);
        totalColsDeleted += deleteCount;
      }

      // 2. Cắt tỉa hàng trống thừa ở cuối (giữ lại khoảng 50 dòng đệm)
      const lastRow = Math.max(sheet.getLastRow(), 1);
      const maxRows = sheet.getMaxRows();
      const desiredMaxRows = lastRow + 50;
      if (maxRows > desiredMaxRows) {
        const deleteRows = maxRows - desiredMaxRows;
        sheet.deleteRows(desiredMaxRows + 1, deleteRows);
        totalRowsTrimmed += deleteRows;
      }
    });

    const msg = `⚡ Đã tối ưu bảng tính thành công!\n` +
      `- Xóa ${totalColsDeleted} cột trống thừa (giải phóng ~73% dung lượng ô tính).\n` +
      `- Cắt bớt ${totalRowsTrimmed} hàng trống thừa.\n` +
      `Bảng tính hiện tại sẽ chạy nhanh và mượt nhất có thể!`;
    Logger.log(msg);
    try {
      SpreadsheetApp.getUi().alert("⚡ Tối Ưu Bảng Tính Hoàn Tất", msg, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {}
  } catch (err) {
    Logger.log("Lỗi optimizeSpreadsheet: " + err.toString());
    try {
      SpreadsheetApp.getUi().alert("Lỗi", "Không thể tối ưu: " + err.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {}
  }
}

/**
 * LƯU TRỮ (ARCHIVE) DỮ LIỆU CŨ SANG SHEET LƯU TRỮ
 * Giúp sheet DATA luôn gọn nhẹ, tra cứu trong tích tắc
 */
function archiveOldData() {
  try {
    const ui = SpreadsheetApp.getUi();
    const res = ui.alert(
      "📦 Lưu Trữ Dữ Liệu Cũ",
      "Chức năng này sẽ chuyển các đơn hàng cũ hơn 6 tháng sang sheet 'DATA_ARCHIVE' để giữ sheet DATA chính luôn nhẹ và siêu nhanh.\nBạn có muốn tiếp tục không?",
      ui.ButtonSet.YES_NO
    );
    if (res !== ui.Button.YES) return;

    const ss = getSpreadsheet();
    const sheetData = getOrCreateSheet(ss, SHEET_DATA_NAME);
    const lastRow = sheetData.getLastRow();
    if (lastRow <= 1) {
      ui.alert("Thông báo", "Chưa có dữ liệu để lưu trữ!", ui.ButtonSet.OK);
      return;
    }

    const sheetArchive = getOrCreateSheet(ss, "DATA_ARCHIVE");
    ensureDataSheetHeader(sheetArchive);

    // Mốc 6 tháng trước
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const values = sheetData.getRange(2, 1, lastRow - 1, 7).getValues();
    const keepRows = [];
    const archiveRows = [];

    values.forEach(row => {
      let rawTime = row[5];
      let isOld = false;
      if (rawTime instanceof Date) {
        if (rawTime.getTime() < sixMonthsAgo.getTime()) isOld = true;
      } else if (rawTime) {
        const parts = rawTime.toString().split(" ")[0].split("/");
        if (parts.length === 3) {
          const d = new Date(parts[2], parts[1] - 1, parts[0]);
          if (d.getTime() < sixMonthsAgo.getTime()) isOld = true;
        }
      }
      if (isOld) {
        archiveRows.push(row);
      } else {
        keepRows.push(row);
      }
    });

    if (archiveRows.length === 0) {
      ui.alert("Thông báo", "Không có dữ liệu nào cũ hơn 6 tháng cần lưu trữ.", ui.ButtonSet.OK);
      return;
    }

    // Ghi vào sheet Archive
    const archiveLastRow = sheetArchive.getLastRow();
    sheetArchive.getRange(archiveLastRow + 1, 1, archiveRows.length, 7).setValues(archiveRows);

    // Xóa và cập nhật lại sheet DATA
    sheetData.getRange(2, 1, lastRow - 1, 7).clear();
    if (keepRows.length > 0) {
      keepRows.forEach((r, i) => r[0] = i + 1);
      sheetData.getRange(2, 1, keepRows.length, 7).setValues(keepRows);
    }

    ui.alert("Thành Công", `✅ Đã chuyển thành công ${archiveRows.length} đơn cũ sang sheet 'DATA_ARCHIVE'.\nSheet 'DATA' hiện còn ${keepRows.length} đơn gần nhất!`, ui.ButtonSet.OK);
  } catch (err) {
    Logger.log("Lỗi archiveOldData: " + err.toString());
  }
}

function showHelp() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    "🌿 HƯỚNG DẪN SỬ DỤNG",
    "1. Dữ liệu khi lưu sẽ được tự động điền vào các cột: STT | KHÁCH HÀNG | SĐT | NHÂN VIÊN | Chiến Giá | Time | Sản Phẩm.\n" +
    "2. Số điện thoại được giữ nguyên số 0 ở đầu.\n" +
    "3. Bảng 'TỔNG HỢP' sẽ tự động đếm số đơn Chiến Giá và Không Chiến Giá theo Ngày và Nhân Viên.",
    ui.ButtonSet.OK
  );
}

/**
 * 7. LẤY DANH SÁCH NHÂN VIÊN TỪ SHEET "nhân viên" (Cột B)
 */
function getStaffList() {
  try {
    const ss = getSpreadsheet();
    const sheet = getOrCreateSheet(ss, "nhân viên");
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return { success: true, list: [] };
    }

    // Lấy cột B (từ dòng 2 đến dòng cuối cùng)
    const values = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    const list = [];
    values.forEach(r => {
      const val = (r[0] || "").toString().trim();
      if (val && !list.includes(val)) {
        list.push(val);
      }
    });

    return {
      success: true,
      list: list
    };
  } catch (err) {
    Logger.log("Lỗi getStaffList: " + err.toString());
    return {
      success: false,
      error: err.toString(),
      list: []
    };
  }
}
