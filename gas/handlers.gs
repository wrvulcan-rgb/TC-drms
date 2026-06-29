// ══════════════════════════════════════════════════════
//  handlers.gs — 各類事件的業務邏輯
// ══════════════════════════════════════════════════════

// ────────────────────────────────
//  新用戶加入
// ────────────────────────────────
function handleFollow(event) {
  var userId = event.source.userId;
  replyText(event.replyToken, [
    '歡迎加入慈濟災害應變系統！',
    '',
    '您可以透過此頻道：',
    '✅ 掃碼報到',
    '📦 三步驟叫料',
    '📡 安全點名回報',
    '🆘 緊急求救',
    '',
    '請等待幹部發送操作卡片。'
  ].join('\n'));
}

// ────────────────────────────────
//  文字訊息
// ────────────────────────────────
function handleMessage(event) {
  if (event.message.type !== 'text') {
    handleImage(event);
    return;
  }

  var text   = event.message.text.trim();
  var userId = event.source.userId;
  var token  = event.replyToken;

  // 關鍵字路由
  if (text === '報到' || text === '簽到') {
    replyCheckinMenu(token);
  } else if (text.match(/^叫料|^需要物資|^申請物資/)) {
    startSupplyWizard(token, userId);
  } else if (text === 'SOS' || text === '求救' || text === '緊急') {
    handleSOS(event, userId, text);
  } else if (text === '安全' || text === '我安全') {
    handleSafetyReport(event, userId, 'safe');
  } else if (text.match(/^編號[:：\s]/)) {
    // 對內慈誠委員輸入編號報到：「編號：CI-001」
    var code = text.replace(/^編號[:：\s]+/, '').trim().toUpperCase();
    handleInnerCheckin(token, userId, code);
  } else {
    replyText(token, '收到您的訊息。如需操作，請傳送：\n「報到」「叫料」「安全」「SOS」');
  }
}

// ── 圖片訊息（勘災照片）──
function handleImage(event) {
  var userId  = event.source.userId;
  var msgId   = event.message.id;
  var ts      = new Date().toLocaleString('zh-TW');

  // 寫紀錄（Drive 上傳需另設 OAuth scope，此處記 log）
  writeLog('照片上傳', userId, '訊息ID:' + msgId, ts);
  rtdbWrite('drive_queue/' + msgId, {
    userId: userId,
    messageId: msgId,
    timestamp: ts,
    status: 'pending'
  });

  replyText(event.replyToken, '📸 照片已收到（ID:' + msgId + '），系統將自動分類至 Drive。');
}

// ────────────────────────────────
//  Postback（按鈕動作）
// ────────────────────────────────
function handlePostback(event) {
  var data   = event.postback.data || '';
  var params = parsePostbackData(data);
  var userId = event.source.userId;
  var token  = event.replyToken;

  switch(params.action) {

    case ACTION.CHECKIN:
      handleOuterCheckin(token, userId, params.email || '');
      break;

    case ACTION.SAFE:
      handleSafetyReport(event, userId, 'safe');
      break;

    case ACTION.SOS:
      handleSOS(event, userId, params.detail || '緊急求救');
      break;

    case ACTION.TASK_DONE:
      handleTaskDone(token, userId, params.id || '');
      break;

    case ACTION.SUPPLY_RECV:
      handleSupplyReceived(token, userId, params.req || '');
      break;

    case ACTION.SUPPLY_ITEM:
      continueSupplyWizard(token, userId, params.item || '', 'qty');
      break;

    case ACTION.SUPPLY_QTY:
      finishSupplyReq(token, userId, params.item || '', params.qty || '', params.site || '');
      break;

    default:
      replyText(token, '未知操作：' + data);
  }
}

// ────────────────────────────────
//  報到
// ────────────────────────────────
function replyCheckinMenu(token) {
  replyFlex(token, {
    type: 'bubble',
    header: flexBox('horizontal', [flexText('✅ 報到', { weight: 'bold', size: 'lg' })],
                    { backgroundColor: '#06C755', paddingAll: '12px' }),
    body: flexBox('vertical', [
      flexText('請選擇報到方式：', { size: 'sm', color: '#555555' }),
      flexButton('📋 輸入編號（慈誠委員）', 'postback', 'action=' + ACTION.CHECKIN + '&type=inner', '#1DB446'),
      flexButton('🌐 掃碼報到（社區志工）', 'uri',
                 (CFG.FIREBASE_URL ? CFG.FIREBASE_URL + '/checkin' : 'https://example.com/checkin'),
                 '#0D86FF'),
    ])
  });
}

function handleInnerCheckin(token, userId, code) {
  if (!code) { replyText(token, '格式錯誤，請傳送「編號：CI-001」'); return; }

  var found  = findInnerMember(code);
  var ts     = new Date().toLocaleString('zh-TW');

  if (!found) {
    replyText(token, '⚠ 找不到編號 ' + code + '，請確認後再試。');
    return;
  }

  writeCheckin('inner', code, found.name, userId, ts);
  rtdbWrite('checkins/' + code, { code: code, name: found.name, userId: userId, time: ts, type: 'inner' });
  replyText(token, '✅ ' + found.name + ' 師兄/姐報到完成！\n時間：' + ts);
}

function handleOuterCheckin(token, userId, email) {
  var ts    = new Date().toLocaleString('zh-TW');
  var found = findVolunteer(email);
  var name  = found ? found.name : '（未知）';

  writeCheckin('outer', email, name, userId, ts);
  rtdbWrite('checkins/outer_' + userId, { email: email, name: name, userId: userId, time: ts, type: 'outer' });
  replyText(token, '✅ ' + name + ' 報到成功！\n時間：' + ts);
}

// ────────────────────────────────
//  叫料（三步驟精靈）
// ────────────────────────────────
// Step 1：顯示品項選單
function startSupplyWizard(token, userId) {
  var buttons = SUPPLY_ITEMS.map(function(item) {
    return flexButton(item, 'postback', 'action=' + ACTION.SUPPLY_ITEM + '&item=' + encodeURIComponent(item), '#777777');
  });
  replyFlex(token, {
    type: 'bubble',
    header: flexBox('horizontal', [flexText('📦 叫料 — 選擇品項', { weight: 'bold', size: 'md' })],
                    { backgroundColor: '#F59E0B', paddingAll: '10px' }),
    body: flexBox('vertical', buttons)
  });
}

// Step 2：選完品項，選數量
function continueSupplyWizard(token, userId, item, step) {
  var qtys = ['×10','×20','×50','×100'];
  var buttons = qtys.map(function(q) {
    return flexButton(q, 'postback',
      'action=' + ACTION.SUPPLY_QTY + '&item=' + encodeURIComponent(item) + '&qty=' + q + '&site=現場', '#777777');
  });
  replyFlex(token, {
    type: 'bubble',
    header: flexBox('horizontal', [flexText('📦 ' + item + ' — 選擇數量', { weight: 'bold', size: 'md' })],
                    { backgroundColor: '#F59E0B', paddingAll: '10px' }),
    body: flexBox('vertical', buttons)
  });
}

// Step 3：寫入需求單
function finishSupplyReq(token, userId, item, qty, site) {
  var ts  = new Date().toLocaleString('zh-TW');
  var id  = 'REQ-' + Date.now().toString().slice(-6);

  writeSupplyReq(id, item, qty, site, userId, ts);
  rtdbWrite('supply_reqs/' + id, {
    id: id, item: item, qty: qty, site: site,
    userId: userId, status: '待派案', prio: 'P2', created: ts
  });

  replyText(token, [
    '✅ 叫料需求已送出！',
    '單號：' + id,
    '品項：' + item + ' ' + qty,
    '地點：' + site,
    '幹部收到後會安排配送，請稍候。'
  ].join('\n'));
}

// ────────────────────────────────
//  安全點名
// ────────────────────────────────
function handleSafetyReport(event, userId, status) {
  var ts = new Date().toLocaleString('zh-TW');
  writeSafetyReport(userId, status, ts);
  rtdbWrite('safety/' + userId, { userId: userId, status: status, time: ts });
  replyText(event.replyToken, status === 'safe'
    ? '✅ 已回報安全，感謝您！'
    : '🆘 求救訊號已送出，請保持聯繫。');
}

// ────────────────────────────────
//  SOS 求救
// ────────────────────────────────
function handleSOS(event, userId, detail) {
  var ts = new Date().toLocaleString('zh-TW');
  writeLog('SOS', userId, detail, ts);
  rtdbWrite('sos', {
    active: true,
    who: '志工 ' + userId.slice(-6),
    detail: detail,
    time: ts,
    userId: userId
  });
  replyText(event.replyToken, '🆘 求救訊號已送達指揮中心！\n請保持手機開機，幹部即刻聯絡您。');
}

// ────────────────────────────────
//  任務完工
// ────────────────────────────────
function handleTaskDone(token, userId, taskId) {
  if (!taskId) { replyText(token, '任務 ID 錯誤'); return; }
  var ts = new Date().toLocaleString('zh-TW');
  writeLog('任務完工', userId, taskId, ts);
  rtdbWrite('tasks/' + taskId + '/status', 'done');
  rtdbWrite('tasks/' + taskId + '/doneBy', userId);
  rtdbWrite('tasks/' + taskId + '/doneAt', ts);
  replyText(token, '✅ 任務 ' + taskId + ' 完工回報完成！\n時間：' + ts + '\n辛苦了！');
}

// ────────────────────────────────
//  物資到貨確認
// ────────────────────────────────
function handleSupplyReceived(token, userId, reqId) {
  if (!reqId) { replyText(token, '需求單號錯誤'); return; }
  var ts = new Date().toLocaleString('zh-TW');
  writeLog('物資到貨', userId, reqId, ts);
  rtdbWrite('supply_reqs/' + reqId + '/status', '已送達');
  rtdbWrite('supply_reqs/' + reqId + '/receivedAt', ts);
  replyText(token, '✅ 已確認收到物資（' + reqId + '）\n時間：' + ts + '\n感恩！');
}

// ────────────────────────────────
//  工具：解析 postback data
// ────────────────────────────────
function parsePostbackData(data) {
  var result = {};
  data.split('&').forEach(function(pair) {
    var parts = pair.split('=');
    if (parts.length === 2) result[parts[0]] = decodeURIComponent(parts[1]);
  });
  return result;
}

// ────────────────────────────────
//  工具：查志工資料（Sheets）
// ────────────────────────────────
function findInnerMember(code) {
  if (!CFG.SHEET_ID) return { name: '（Sheets未設定）' };
  try {
    var ss    = SpreadsheetApp.openById(CFG.SHEET_ID);
    var sheet = ss.getSheetByName(CFG.INNER_SHEET);
    if (!sheet) return null;
    var data  = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toUpperCase() === code) return { code: data[i][0], name: data[i][1] };
    }
    return null;
  } catch(err) { logError('findInnerMember', err.toString(), { code: code }); return null; }
}

function findVolunteer(email) {
  if (!CFG.SHEET_ID || !email) return null;
  try {
    var ss    = SpreadsheetApp.openById(CFG.SHEET_ID);
    var sheet = ss.getSheetByName(CFG.VOLUNTEER_SHEET);
    if (!sheet) return null;
    var data  = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][2] === email) return { name: data[i][0], email: email };
    }
    return null;
  } catch(err) { return null; }
}
