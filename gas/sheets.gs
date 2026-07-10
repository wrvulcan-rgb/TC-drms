// ══════════════════════════════════════════════════════
//  sheets.gs — Google Sheets 讀寫 + Firebase RTDB + 錯誤紀錄
// ══════════════════════════════════════════════════════

// ── 報到紀錄寫入 Sheets ──
function writeCheckin(type, code, name, userId, ts) {
  appendRow(CFG.LOG_SHEET, ['報到', type, code, name, userId, ts]);
}

// ── 叫料需求寫入 Sheets ──
function writeSupplyReq(id, item, qty, site, userId, ts) {
  appendRow(CFG.LOG_SHEET, ['叫料', id, item, qty, site, userId, '待派案', ts]);
}

// ── 安全點名回報寫入 Sheets ──
function writeSafetyReport(userId, status, ts) {
  appendRow(CFG.LOG_SHEET, ['點名回報', userId, status, ts]);
}

// ── 通用事件紀錄 ──
function writeLog(type, userId, detail, ts) {
  appendRow(CFG.LOG_SHEET, [type, userId, detail, ts]);
}

// ── 通用：追加一列 ──
function appendRow(sheetName, values) {
  if (!CFG.SHEET_ID) return;
  try {
    var ss    = SpreadsheetApp.openById(CFG.SHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      // 補表頭
      if (sheetName === CFG.LOG_SHEET) {
        sheet.appendRow(['類型','欄位1','欄位2','欄位3','欄位4','欄位5','欄位6','時間']);
      }
    }
    sheet.appendRow(values);
  } catch(err) {
    logError('appendRow', err.toString(), { sheet: sheetName });
  }
}

// ────────────────────────────────
//  Firebase RTDB 寫入（REST API）
// ────────────────────────────────
// 資安 F8：path 由 caseId/taskId/reqId/code 等外部可控參數組成。逐段消毒：
//   - 移除 Firebase 非法字元（. # $ [ ]）與控制字元
//   - 丟棄 '..'/'.'/空段，杜絕路徑穿越（如 caseId='../../sos'）
// 保留 '/' 作為結構分隔，故 'tasks/T-9/status' 這類正常路徑不受影響。
function _safePath(path) {
  return String(path).split('/').map(function(seg) {
    return seg.replace(/[.#$\[\]\x00-\x1f]/g, '');
  }).filter(function(seg) {
    return seg !== '' && seg !== '..' && seg !== '.';
  }).join('/');
}

function rtdbWrite(path, value) {
  if (!CFG.FIREBASE_URL) return; // 未設定就跳過，不影響主流程

  var url = CFG.FIREBASE_URL.replace(/\/$/, '') + '/' + _safePath(path) + '.json';
  if (CFG.FIREBASE_SECRET) url += '?auth=' + CFG.FIREBASE_SECRET;

  try {
    UrlFetchApp.fetch(url, {
      method: 'PUT',
      contentType: 'application/json',
      payload: JSON.stringify(value),
      muteHttpExceptions: true
    });
  } catch(err) {
    logError('rtdbWrite', err.toString(), { path: path });
  }
}

function rtdbPush(path, value) {
  if (!CFG.FIREBASE_URL) return;

  var url = CFG.FIREBASE_URL.replace(/\/$/, '') + '/' + _safePath(path) + '.json';
  if (CFG.FIREBASE_SECRET) url += '?auth=' + CFG.FIREBASE_SECRET;

  try {
    UrlFetchApp.fetch(url, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(value),
      muteHttpExceptions: true
    });
  } catch(err) {
    logError('rtdbPush', err.toString(), { path: path });
  }
}

// ────────────────────────────────
//  錯誤與警告紀錄
// ────────────────────────────────
function logError(fn, msg, context) {
  var ts  = new Date().toISOString();
  var row = ['ERROR', ts, fn, msg, JSON.stringify(context)];
  try {
    if (CFG.SHEET_ID) {
      var ss    = SpreadsheetApp.openById(CFG.SHEET_ID);
      var sheet = ss.getSheetByName('錯誤紀錄') || ss.insertSheet('錯誤紀錄');
      sheet.appendRow(row);
    }
  } catch(e) {}
  console.error('[DRMS] ' + fn + ' | ' + msg);
}

function logWarn(msg) {
  console.warn('[DRMS] ' + msg);
}
