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
  } else if (text.match(/^開伙[\s:：]*(\d+)/)) {
    // 香積組長快捷輸入：「開伙 120」
    var mealM = text.match(/^開伙[\s:：]*(\d+)/);
    handleMealCount(token, userId, mealM[1], '');
  } else if (text.match(/^交接/)) {
    // 班長快捷輸入：「交接：現場狀況摘要」
    handleHandover(token, userId, '', text.replace(/^交接[\s:：]*/, ''));
  } else if (text.match(/^受阻/)) {
    // 班長快捷輸入：「受阻：怪手無法進場」
    handleSquadBlocked(token, userId, '', text.replace(/^受阻[\s:：]*/, ''));
  } else {
    replyText(token, '收到您的訊息。如需操作，請傳送：\n「報到」「叫料」「安全」「SOS」\n「開伙 <份數>」「交接：<摘要>」「受阻：<原因>」');
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
//  Postback（按鈕動作）→ 統一動作路由
// ────────────────────────────────
function handlePostback(event) {
  var data   = event.postback.data || '';
  var params = parsePostbackData(data);
  var userId = event.source.userId;
  var token  = event.replyToken;

  if (!routeAction(params.action || '', { token: token, userId: userId, params: params })) {
    replyText(token, '未知操作：' + data);
  }
}

// ── 統一動作路由：LINE postback 與 DRMS 橋接共用同一張表 ──
// ctx = { token（LINE replyToken；橋接=null → 回覆進 BRIDGE_CTX）, userId, params }
// 回傳 true=已處理 / false=未知動作
function routeAction(action, ctx) {
  var token  = ctx.token;
  var userId = ctx.userId;
  var p      = ctx.params || {};

  switch(action) {

    // ── 志工/司機 核心 ──
    case ACTION.CHECKIN:
      handleOuterCheckin(token, userId, p.email || '');
      return true;
    case ACTION.SAFE:
      handleSafetyReport({ replyToken: token }, userId, 'safe');
      return true;
    case ACTION.SOS:
      handleSOS({ replyToken: token }, userId, p.detail || '緊急求救');
      return true;
    case ACTION.TASK_DONE:
      handleTaskDone(token, userId, p.id || '');
      return true;
    case ACTION.SUPPLY_RECV:
      handleSupplyReceived(token, userId, p.req || '');
      return true;
    case ACTION.SUPPLY_START:
      startSupplyWizard(token, userId);
      return true;
    case ACTION.SUPPLY_ITEM:
      continueSupplyWizard(token, userId, p.item || '', 'qty');
      return true;
    case ACTION.SUPPLY_QTY:
      finishSupplyReq(token, userId, p.item || '', p.qty || '', p.site || '');
      return true;

    // ── 班長 squad_* ──
    case ACTION.SQUAD_ACCEPT:
      handleSquadAccept(token, userId, p.id || '', p.decision || 'accept', p.squad || '');
      return true;
    case ACTION.SQUAD_ROLLCALL:
      handleSquadRollcall(token, userId, p.squad || '');
      return true;
    case ACTION.SQUAD_REPORT:
      handleSquadReport(token, userId, p.id || '', p.pct || '', p.note || '');
      return true;
    case ACTION.SQUAD_BLOCKED:
      handleSquadBlocked(token, userId, p.id || '', p.reason || '');
      return true;
    case ACTION.HANDOVER:
      handleHandover(token, userId, p.squad || '', p.note || '');
      return true;

    // ── 司機 ──
    case ACTION.DEPART:
      handleDepart(token, userId, p.req || '');
      return true;

    // ── 香積 meal_* ──
    case ACTION.MEAL_COUNT:
      handleMealCount(token, userId, p.count || '', p.site || '');
      return true;
    case ACTION.MEAL_DONE:
      handleMealDone(token, userId, p.count || '', p.site || '');
      return true;

    // ── 訪視 visit_* ──
    case ACTION.VISIT_START:
      handleVisitStart(token, userId, p.caseId || '');
      return true;
    case ACTION.VISIT_DONE:
      handleVisitDone(token, userId, p.caseId || '', p.note || '');
      return true;
    case ACTION.AID_REQUEST:
      handleAidRequest(token, userId, p.caseId || '');
      return true;
    case ACTION.PSYCH_REFER:
      handlePsychRefer(token, userId, p.caseId || '');
      return true;

    // ── 幹部 ──
    case ACTION.RISK_APPROVE:
      handleRiskApprove(token, userId, p.id || '', p.decision || 'approve');
      return true;
    case ACTION.CASE_CLOSE:
      handleCaseClose(token, userId, p.caseId || '');
      return true;

    default:
      return false;
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

// ════════════════════════════════
//  LOA_ROLES_SPEC 補齊：班長 / 司機 / 香積 / 訪視 / 幹部
//  （原標記「GAS ACTION 待串接」的 14 顆按鈕後端）
// ════════════════════════════════

// ── 班長：接單狀態機（INFO_CHAIN_ADOPTION P1：pending → accepted/declined）──
function handleSquadAccept(token, userId, taskId, decision, squad) {
  if (!taskId) { replyText(token, '任務 ID 錯誤'); return; }
  var ts = new Date().toLocaleString('zh-TW');
  var sq = squad || 'SQ-01';
  var accepted = decision !== 'decline';
  rtdbWrite('assignments/' + taskId, {
    task_id: taskId, user_id: userId, squad: sq,
    status: accepted ? 'accepted' : 'declined', responded_ts: ts
  });
  if (accepted) {
    rtdbWrite('tasks/' + taskId + '/status', '進行中');
    rtdbWrite('tasks/' + taskId + '/lockedBy', sq);
    writeLog('班長接單', userId, taskId + ' → ' + sq, ts);
    replyText(token, '🎯 已接單 ' + taskId + '（' + sq + '）\n系統已通知班員集合。');
  } else {
    rtdbWrite('tasks/' + taskId + '/status', '待派工');
    writeLog('班長婉拒', userId, taskId, ts);
    replyText(token, '已婉拒 ' + taskId + '，任務退回待派池，指揮中心將重新派遣。');
  }
}

// ── 班長：班員點名（班級粒度；點名發起紀錄，班員各自回 SAFE/SOS）──
function handleSquadRollcall(token, userId, squad) {
  var ts = new Date().toLocaleString('zh-TW');
  var sq = squad || 'SQ-01';
  rtdbPush('rollcalls', { squad: sq, firedBy: userId, time: ts, scope: 'squad' });
  writeLog('班組點名', userId, sq, ts);
  replyText(token, '📡 班組 ' + sq + ' 點名已發起\n班員回報後可在中台看到彙整結果。');
}

// ── 班長：進度回報 ──
function handleSquadReport(token, userId, taskId, pct, note) {
  var ts = new Date().toLocaleString('zh-TW');
  if (taskId && pct) rtdbWrite('tasks/' + taskId + '/pct', Number(pct) || 0);
  rtdbPush('reportLog', { time: ts, msg: '🪖 班長回報' + (taskId ? '「' + taskId + '」' : '') + (pct ? ' 進度 ' + pct + '%' : '') + (note ? '：' + note : ''), by: userId });
  writeLog('進度回報', userId, (taskId || '—') + ' ' + (pct ? pct + '%' : '') + ' ' + (note || ''), ts);
  replyText(token, '📈 進度已回報指揮中心' + (pct ? '（' + pct + '%）' : '') + '。');
}

// ── 班長：現場受阻 → 幹部端警示 ──
function handleSquadBlocked(token, userId, taskId, reason) {
  var ts = new Date().toLocaleString('zh-TW');
  if (taskId) rtdbWrite('tasks/' + taskId + '/status', '受阻');
  rtdbPush('alerts', { type: 'blocked', taskId: taskId || '', reason: reason || '現場受阻', by: userId, time: ts });
  writeLog('現場受阻', userId, (taskId || '—') + '：' + (reason || ''), ts);
  replyText(token, '⚠ 受阻狀態已上報指揮中心' + (taskId ? '（' + taskId + '）' : '') + '\n請於原地等候協調指示。');
}

// ── 班長：交接快照（⑦ 交接鏈）──
function handleHandover(token, userId, squad, note) {
  var ts = new Date().toLocaleString('zh-TW');
  var sq = squad || 'SQ-01';
  rtdbPush('handover_log', { squad: sq, note: note || '', by: userId, time: ts });
  writeLog('交接快照', userId, sq + '：' + (note || '（系統彙整）'), ts);
  replyText(token, '🤝 交接快照已存檔（' + sq + '）\n請下梯班長於系統確認簽收。');
}

// ── 司機：出發回報 → 需求單轉「配送中」，中台看得到在途 ──
function handleDepart(token, userId, reqId) {
  if (!reqId) { replyText(token, '需求單號錯誤'); return; }
  var ts = new Date().toLocaleString('zh-TW');
  rtdbWrite('supply_reqs/' + reqId + '/status', '配送中');
  rtdbWrite('supply_reqs/' + reqId + '/departAt', ts);
  writeLog('司機出發', userId, reqId, ts);
  replyText(token, '🚚 出發回報已記錄（' + reqId + '）\n抵達後請按「✅ 已到貨」。');
}

// ── 香積：今日開伙數登記 → 驅動倉儲供需預估 ──
function handleMealCount(token, userId, count, site) {
  var n = Number(count) || 0;
  if (!n) { replyText(token, '份數格式錯誤，請傳「開伙 120」或用選單操作。'); return; }
  var ts = new Date().toLocaleString('zh-TW');
  var st = site || '香積站';
  rtdbWrite('kitchen/' + encodeURIComponent(st), { site: st, mealsToday: n, status: '備餐中', by: userId, time: ts });
  writeLog('開伙登記', userId, st + '：' + n + ' 份', ts);
  replyText(token, '🍱 已登記今日開伙 ' + n + ' 份（' + st + '）\n倉儲供需預估同步更新。');
}

// ── 香積：出餐完成 ──
function handleMealDone(token, userId, count, site) {
  var ts = new Date().toLocaleString('zh-TW');
  var st = site || '香積站';
  rtdbWrite('kitchen/' + encodeURIComponent(st) + '/status', '供餐完成');
  rtdbPush('kitchen_log', { site: st, qty: Number(count) || 0, note: '出餐完成', by: userId, time: ts });
  writeLog('出餐完成', userId, st + '：' + (count || '?') + ' 份', ts);
  replyText(token, '✅ 出餐完成已回報（' + st + (count ? '，' + count + ' 份' : '') + '），感恩！');
}

// ── 訪視：開始訪視 ──
function handleVisitStart(token, userId, caseId) {
  if (!caseId) { replyText(token, '個案編號錯誤'); return; }
  var ts = new Date().toLocaleString('zh-TW');
  rtdbWrite('visits/' + caseId, { caseId: caseId, status: '訪視中', by: userId, startAt: ts });
  writeLog('訪視開始', userId, caseId, ts);
  replyText(token, '🏠 已登記開始訪視（' + caseId + '）\n完成後請按「✍ 完成訪視」。');
}

// ── 訪視：完成訪視＋關懷紀錄 ──
function handleVisitDone(token, userId, caseId, note) {
  if (!caseId) { replyText(token, '個案編號錯誤'); return; }
  var ts = new Date().toLocaleString('zh-TW');
  rtdbWrite('visits/' + caseId + '/status', '已完成');
  rtdbWrite('visits/' + caseId + '/doneAt', ts);
  if (note) rtdbWrite('visits/' + caseId + '/note', note);
  writeLog('訪視完成', userId, caseId + (note ? '：' + note : ''), ts);
  replyText(token, '✅ 訪視紀錄已建檔（' + caseId + '），感恩！');
}

// ── 訪視：慰問金申請（進五步驟審核鏈第 1 步）──
function handleAidRequest(token, userId, caseId) {
  if (!caseId) { replyText(token, '個案編號錯誤'); return; }
  var ts = new Date().toLocaleString('zh-TW');
  rtdbPush('relief_queue', { caseId: caseId, by: userId, time: ts, status: '申請' });
  writeLog('慰問金申請', userId, caseId, ts);
  replyText(token, '💰 慰問金申請已送出（' + caseId + '）\n狀態：審核中，幹部審核後核發。');
}

// ── 訪視：轉介心理 ──
function handlePsychRefer(token, userId, caseId) {
  if (!caseId) { replyText(token, '個案編號錯誤'); return; }
  var ts = new Date().toLocaleString('zh-TW');
  rtdbWrite('visits/' + caseId + '/psych', true);
  rtdbPush('psych_refers', { caseId: caseId, by: userId, time: ts });
  writeLog('心理轉介', userId, caseId, ts);
  replyText(token, '🧠 已轉介專業心理師（' + caseId + '）\n個案已納入長期陪伴名單。');
}

// ── 幹部：高風險派工覆核（守門：班組不可自行承接高風險任務）──
function handleRiskApprove(token, userId, taskId, decision) {
  if (!taskId) { replyText(token, '任務 ID 錯誤'); return; }
  var ts = new Date().toLocaleString('zh-TW');
  var approved = decision !== 'reject';
  rtdbWrite('tasks/' + taskId + '/riskGate', { status: approved ? 'approved' : 'rejected', by: userId, time: ts });
  if (approved) {
    rtdbWrite('tasks/' + taskId + '/status', '進行中');
    writeLog('高風險核准', userId, taskId, ts);
    replyText(token, '✅ 已核准高風險任務 ' + taskId + ' 派遣班組，已通知班長。');
  } else {
    rtdbWrite('tasks/' + taskId + '/status', '待派工');
    writeLog('高風險駁回', userId, taskId, ts);
    replyText(token, '⛔ 已駁回 ' + taskId + ' 班組承接，任務保留給專業隊伍。');
  }
}

// ── 幹部：結案確認（⑧ 結案 → phase='結案' 回寫）──
function handleCaseClose(token, userId, caseId) {
  if (!caseId) { replyText(token, '個案編號錯誤'); return; }
  var ts = new Date().toLocaleString('zh-TW');
  rtdbWrite('cases/' + caseId + '/phase', '結案');
  rtdbWrite('cases/' + caseId + '/closedAt', ts);
  rtdbWrite('cases/' + caseId + '/closedBy', userId);
  writeLog('結案確認', userId, caseId, ts);
  replyText(token, '📋 ' + caseId + ' 已結案\n歷程封存、求助單同步更新。');
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
