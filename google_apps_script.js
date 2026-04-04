// ============================================================
// 花壇國中 三年八班 同學會 — Google Apps Script
// 功能：報名寫入 + 報名狀態讀取 + 取消報名
// ============================================================

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // ── 讀取報名狀態 ──
  if (e.parameter.action === 'list') {
    var data = sheet.getDataRange().getValues();
    var names = [];
    var totalAttendees = 0;

    // 跳過標題列 (row 1)
    for (var i = 1; i < data.length; i++) {
      var name = (data[i][1] || '').toString().trim();
      var att  = parseInt(data[i][2]) || 1;
      if (name) {
        names.push(name);
        totalAttendees += att;
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      count: names.length,
      totalAttendees: totalAttendees,
      names: names,
      updatedAt: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ── 取消報名 ──
  if (e.parameter.action === 'cancel') {
    var cancelName = (e.parameter.name || '').toString().trim();
    var cancelPhone = (e.parameter.phone || '').toString().trim();

    if (!cancelName || !cancelPhone) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: '請提供姓名和電話'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var data = sheet.getDataRange().getValues();
    var found = false;

    // 從最後一列往前搜尋（避免刪除後索引偏移）
    for (var i = data.length - 1; i >= 1; i--) {
      var rowName = (data[i][1] || '').toString().trim();
      var rowPhone = (data[i][3] || '').toString().trim();

      if (rowName === cancelName && rowPhone === cancelPhone) {
        sheet.deleteRow(i + 1); // Sheets 是 1-based
        found = true;
        break;
      }
    }

    if (found) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: cancelName + '，您的報名已取消'
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: '找不到符合的報名資料，請確認姓名與電話是否正確'
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // ── 報名寫入 ──
  sheet.appendRow([
    new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
    e.parameter.name,
    e.parameter.attendees,
    e.parameter.phone,
    e.parameter.note || ''
  ]);

  return ContentService.createTextOutput(JSON.stringify({
    status: 'success'
  })).setMimeType(ContentService.MimeType.JSON);
}
