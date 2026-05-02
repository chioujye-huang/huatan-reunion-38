// ============================================================
// 花壇國中 三年八班 同學會 — Google Apps Script
// 後端試算表：花壇國中三年八班同學會報名表.xlsx (Google Drive)
// 分頁：
//   ■ 報名      欄位：A 姓名 | B (留空) | C 電話 | D 參加人數 | E 備註 | F 時間
//   ■ 日期投票  欄位：A 姓名 | B-G 第一志願～第六志願 | H 時間
//   ■ 餐廳投票  欄位：A 姓名 | B 第一志願 | C 第二志願 | D 第三志願 | E 推薦餐廳 | F 時間
// ============================================================

const SHEET_REG  = '報名';
const SHEET_DATE = '日期投票';
const SHEET_REST = '餐廳投票';

function tw(d) {
  return (d || new Date()).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(ss, name) {
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    if (name === SHEET_REG)  s.appendRow(['姓名', '', '電話', '參加人數', '備註', '時間']);
    if (name === SHEET_DATE) s.appendRow(['姓名', '第一志願', '第二志願', '第三志願', '第四志願', '第五志願', '第六志願', '時間']);
    if (name === SHEET_REST) s.appendRow(['姓名', '第一志願', '第二志願', '第三志願', '推薦餐廳', '時間']);
  }
  return s;
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = (e.parameter.action || 'register').trim();

  // ── 日期投票 (vote) ──
  if (action === 'vote') {
    const sh = getSheet(ss, SHEET_DATE);
    sh.appendRow([
      e.parameter.name || '',
      e.parameter.date1 || '',
      e.parameter.date2 || '',
      e.parameter.date3 || '',
      e.parameter.date4 || '',
      e.parameter.date5 || '',
      e.parameter.date6 || '',
      tw()
    ]);
    // 同時若有餐廳偏好或推薦，寫到餐廳投票分頁
    const restPref = e.parameter.restaurant || '';
    const recommend = e.parameter.recommend || '';
    if (restPref || recommend) {
      const sr = getSheet(ss, SHEET_REST);
      sr.appendRow([
        e.parameter.name || '',
        restPref,
        '',
        '',
        recommend,
        tw()
      ]);
    }
    return jsonOut({ status: 'success' });
  }

  // ── 餐廳投票 (restaurantVote) ──
  if (action === 'restaurantVote') {
    const sh = getSheet(ss, SHEET_REST);
    sh.appendRow([
      e.parameter.name || '',
      e.parameter.r1 || '',
      e.parameter.r2 || '',
      e.parameter.r3 || '',
      e.parameter.recommend || '',
      tw()
    ]);
    return jsonOut({ status: 'success' });
  }

  // ── 投票結果 (日期 & 餐廳統計) ──
  if (action === 'voteResults') {
    // 日期：依志願加權（第一志願 6 分、第二 5 分、…、第六 1 分）
    const result = { dateRanked: [], restaurant: [] };

    const ds = ss.getSheetByName(SHEET_DATE);
    if (ds) {
      const data = ds.getDataRange().getValues();
      const score = {}, totals = {};
      for (let i = 1; i < data.length; i++) {
        const picks = [data[i][1], data[i][2], data[i][3], data[i][4], data[i][5], data[i][6]]
          .map(x => (x || '').toString().trim());
        picks.forEach((p, idx) => {
          if (!p) return;
          score[p] = (score[p] || 0) + (6 - idx);
          totals[p] = (totals[p] || 0) + 1;
        });
      }
      result.dateRanked = Object.keys(score).map(k => ({ name: k, score: score[k], count: totals[k] }))
        .sort((a, b) => b.score - a.score);
    }

    const rs = ss.getSheetByName(SHEET_REST);
    if (rs) {
      const data = rs.getDataRange().getValues();
      const counts = {};
      for (let i = 1; i < data.length; i++) {
        const picks = [data[i][1], data[i][2], data[i][3]].map(x => (x || '').toString().trim());
        picks.forEach((p) => {
          if (!p) return;
          counts[p] = (counts[p] || 0) + 1;
        });
      }
      result.restaurant = Object.keys(counts).map(k => ({ name: k, count: counts[k] }))
        .sort((a, b) => b.count - a.count);
    }

    return jsonOut({ status: 'success', ...result });
  }

  // ── 讀取報名狀態 (list) ──
  if (action === 'list') {
    const sh = getSheet(ss, SHEET_REG);
    const data = sh.getDataRange().getValues();
    const names = [];
    let totalAttendees = 0;
    for (let i = 1; i < data.length; i++) {
      const name = (data[i][0] || '').toString().trim();
      const att = parseInt(data[i][3]) || 1;
      if (name) {
        names.push(name);
        totalAttendees += att;
      }
    }
    return jsonOut({
      status: 'success',
      count: names.length,
      totalAttendees: totalAttendees,
      names: names,
      updatedAt: tw()
    });
  }

  // ── 取消報名 (cancel) ──
  // 連動刪除：同名的「日期投票」「餐廳投票」也一併清除，避免票數失真
  if (action === 'cancel') {
    const regSh = getSheet(ss, SHEET_REG);
    const cancelName = (e.parameter.name || '').toString().trim();
    const cancelPhone = (e.parameter.phone || '').toString().trim();

    if (!cancelName || !cancelPhone) {
      return jsonOut({ status: 'error', message: '請提供姓名和電話' });
    }

    // (1) 刪除「報名」分頁中對應的列（用姓名 + 電話雙重比對）
    const regData = regSh.getDataRange().getValues();
    let found = false;
    for (let i = regData.length - 1; i >= 1; i--) {
      const rowName  = (regData[i][0] || '').toString().trim();
      const rowPhone = (regData[i][2] || '').toString().trim();
      if (rowName === cancelName && rowPhone === cancelPhone) {
        regSh.deleteRow(i + 1);
        found = true;
        break;
      }
    }

    if (!found) {
      return jsonOut({ status: 'error', message: '找不到符合的報名資料，請確認姓名與電話是否正確' });
    }

    // (2) 連動刪除「日期投票」分頁中所有同姓名的列
    let dateVotesRemoved = 0;
    const dateSh = ss.getSheetByName(SHEET_DATE);
    if (dateSh) {
      const dateData = dateSh.getDataRange().getValues();
      for (let i = dateData.length - 1; i >= 1; i--) {
        const rowName = (dateData[i][0] || '').toString().trim();
        if (rowName === cancelName) {
          dateSh.deleteRow(i + 1);
          dateVotesRemoved++;
        }
      }
    }

    // (3) 連動刪除「餐廳投票」分頁中所有同姓名的列
    let restVotesRemoved = 0;
    const restSh = ss.getSheetByName(SHEET_REST);
    if (restSh) {
      const restData = restSh.getDataRange().getValues();
      for (let i = restData.length - 1; i >= 1; i--) {
        const rowName = (restData[i][0] || '').toString().trim();
        if (rowName === cancelName) {
          restSh.deleteRow(i + 1);
          restVotesRemoved++;
        }
      }
    }

    let msg = cancelName + '，您的報名已取消';
    if (dateVotesRemoved + restVotesRemoved > 0) {
      msg += '（同時移除 ' + dateVotesRemoved + ' 筆日期投票、' + restVotesRemoved + ' 筆餐廳投票）';
    }
    return jsonOut({
      status: 'success',
      message: msg,
      dateVotesRemoved: dateVotesRemoved,
      restVotesRemoved: restVotesRemoved
    });
  }

  // ── 預設：報名寫入 ──
  // 欄位順序：A 姓名 | B 留空 | C 電話 | D 參加人數 | E 備註 | F 時間
  const sh = getSheet(ss, SHEET_REG);
  sh.appendRow([
    e.parameter.name || '',
    '',
    e.parameter.phone || '',
    parseInt(e.parameter.attendees) || 1,
    e.parameter.note || '',
    tw()
  ]);
  return jsonOut({ status: 'success' });
}
