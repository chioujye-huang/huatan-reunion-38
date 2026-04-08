// ============================================================
// 花壇國中 三年八班 同學會 — Google Apps Script
// 功能：報名寫入 + 報名狀態讀取 + 取消報名 + 餐廳投票（獨立分頁）
// ============================================================

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── 投票功能（寫入「投票結果」分頁）──
  if (e.parameter.action === 'vote') {
    var voteSheet = ss.getSheetByName('投票結果');
    if (!voteSheet) {
      voteSheet = ss.insertSheet('投票結果');
      voteSheet.appendRow(['時間', '姓名', '偏好日期', '偏好餐廳', '推薦餐廳']);
    }
    voteSheet.appendRow([
      new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
      e.parameter.name || '',
      e.parameter.date || '',
      e.parameter.restaurant || '',
      e.parameter.recommend || ''
    ]);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ── 投票結果統計 ──
  if (e.parameter.action === 'voteResults') {
    var voteSheet = ss.getSheetByName('投票結果');
    if (!voteSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success', results: []
      })).setMimeType(ContentService.MimeType.JSON);
    }
    var data = voteSheet.getDataRange().getValues();
    var counts = {};
    for (var i = 1; i < data.length; i++) {
      var restaurant = (data[i][3] || '').toString().trim();
      if (restaurant) {
        counts[restaurant] = (counts[restaurant] || 0) + 1;
      }
    }
    var results = [];
    for (var key in counts) {
      results.push({ name: key, count: counts[key] });
    }
    results.sort(function(a, b) { return b.count - a.count; });

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      results: results
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // ── 讀取報名狀態 ──
  if (e.parameter.action === 'list') {
    var regSheet = ss.getSheetByName('報名') || ss.getActiveSheet();
    var data = regSheet.getDataRange().getValues();
    var names = [];
    var totalAttendees = 0;
    for (var i = 1; i < data.length; i++) {
      var name = (data[i][1] || '').toString().trim();
      var att = parseInt(data[i][2]) || 1;
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
    var regSheet = ss.getSheetByName('報名') || ss.getActiveSheet();
    var cancelName = (e.parameter.name || '').toString().trim();
    var cancelPhone = (e.parameter.phone || '').toString().trim();

    if (!cancelName || !cancelPhone) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error', message: '請提供姓名和電話'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var data = regSheet.getDataRange().getValues();
    var found = false;
    for (var i = data.length - 1; i >= 1; i--) {
      var rowName = (data[i][1] || '').toString().trim();
      var rowPhone = (data[i][3] || '').toString().trim();
      if (rowName === cancelName && rowPhone === cancelPhone) {
        regSheet.deleteRow(i + 1);
        found = true;
        break;
      }
    }

    if (found) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success', message: cancelName + '，您的報名已取消'
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error', message: '找不到符合的報名資料，請確認姓名與電話是否正確'
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // ── 報名寫入 ──
  var regSheet = ss.getSheetByName('報名') || ss.getActiveSheet();
  regSheet.appendRow([
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