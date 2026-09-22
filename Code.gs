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

  // 2. Nhận lưu dữ liệu gửi qua GET (Dự phòng cho GitHub Pages)
  if (e && e.parameter && (e.parameter.khachHang || e.parameter.sdt)) {
    let data = e.parameter;
    if (typeof data.chienGia === "string") {
      data.chienGia = (data.chienGia.toLowerCase() === "true" || data.chienGia === "1");
    }
    const result = saveCustomerData(data);
    return createJsonResponse(result, e.parameter.callback);
  }

  // 3. API lấy dữ liệu Báo Cáo Tổng Hợp cho giao diện Web
  if (e && e.parameter && (e.parameter.action === "getReport" || e.parameter.action === "getData")) {
    const report = getReportData();
    return createJsonResponse(report, e.parameter.callback);
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

    // Khử trùng lặp trong 4 giây (phòng trường hợp gửi kép POST và GET)
    const cache = CacheService.getScriptCache();
    const cacheKey = "save_" + encodeURIComponent(khachHang + "_" + sdtRaw);
    if (cache.get(cacheKey)) {
      return { success: true, message: `Đơn khách ${khachHang} đã được lưu thành công!` };
    }
    cache.put(cacheKey, "ok", 5);

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

    // Định dạng thẩm mỹ cho dòng vừa ghi
    sheetData.setRowHeight(targetRow, 32);
    const rowRange = sheetData.getRange(targetRow, 1, 1, 7);
    rowRange
      .setFontFamily("Arial")
      .setFontSize(10)
      .setVerticalAlignment("middle")
      .setBorder(true, true, true, true, true, true, THEME.BORDER_COLOR, SpreadsheetApp.BorderStyle.SOLID);

    // Căn giữa: STT(1), SĐT(3), NHÂN VIÊN(4), Chiến Giá(5), Time(6)
    [1, 3, 4, 5, 6].forEach(col => {
      sheetData.getRange(targetRow, col).setHorizontalAlignment("center");
    });
    // Căn trái: KHÁCH HÀNG(2), Sản Phẩm(7)
    [2, 7].forEach(col => {
      sheetData.getRange(targetRow, col).setHorizontalAlignment("left");
    });

    // Tô màu nổi bật cho ô Chiến Giá
    const cellChienGia = sheetData.getRange(targetRow, 5);
    if (isChienGia) {
      cellChienGia
        .setBackground(THEME.YES_BADGE_BG)
        .setFontColor(THEME.YES_BADGE_TEXT)
        .setFontWeight("bold");
    } else {
      cellChienGia
        .setBackground(THEME.NO_BADGE_BG)
        .setFontColor(THEME.NO_BADGE_TEXT)
        .setFontWeight("normal");
    }

    // Tự động làm mới Sheet TỔNG HỢP
    updateSummarySheetInternal(ss);

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

  for (let r = 0; r < numRows; r++) {
    sheetSummary.setRowHeight(startRow + r, 30);
  }

  sheetSummary.getRange(startRow, 1, numRows, 1).setHorizontalAlignment("center");
  sheetSummary.getRange(startRow, 2, numRows, 1).setHorizontalAlignment("center").setNumberFormat("@"); // Định dạng text để giữ full ngày giờ
  sheetSummary.getRange(startRow, 3, numRows, 1).setHorizontalAlignment("left");
  sheetSummary.getRange(startRow, 4, numRows, 4).setHorizontalAlignment("center");
  sheetSummary.getRange(startRow, 7, numRows, 1).setNumberFormat("0.0%");

  // Định dạng dòng TỔNG CỘNG
  const totalRowRange = sheetSummary.getRange(startRow + numRows - 1, 1, 1, 7);
  totalRowRange
    .setFontWeight("bold")
    .setBackground(THEME.TOTAL_BG)
    .setFontColor(THEME.TOTAL_TEXT)
    .setBorder(true, true, true, true, true, true, THEME.TOTAL_TEXT, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}

/**
 * 6. LẤY DỮ LIỆU BÁO CÁO CHO WEB FORM TỔNG HỢP
 */
function getReportData() {
  try {
    const ss = getSpreadsheet();
    const sheetData = getOrCreateSheet(ss, SHEET_DATA_NAME);
    const lastRow = sheetData.getLastRow();
    if (lastRow <= 1) {
      return { success: true, list: [], dates: [] };
    }

    const dataValues = sheetData.getRange(2, 1, lastRow - 1, 7).getValues();
    const list = [];
    const dateSet = {};

    dataValues.forEach((row, idx) => {
      const stt = row[0] || (idx + 1);
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
    });

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
