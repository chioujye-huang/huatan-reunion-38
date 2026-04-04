// ============================================================
// 花壇國中 三年八班 同學會 — Google Apps Script
// 功能：報名寫入 + 報名狀態讀取
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
