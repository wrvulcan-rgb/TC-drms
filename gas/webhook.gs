// ══════════════════════════════════════════════════════
//  webhook.gs — 入口：LINE Webhook + DRMS 網頁橋接 + 健康檢查
//  Line Developers Console → Webhook URL 填 /exec 網址（建議加 ?token=<WEBHOOK_TOKEN>）
// ══════════════════════════════════════════════════════

function doPost(e) {
  try {
    var body = e.postData.contents;
    var payload;
    try { payload = JSON.parse(body); }
    catch(parseErr) { return respond(400, 'Bad JSON'); }

    // 0. DRMS 網頁橋接（模擬器 ⇄ 真實後端直連，不經 LINE；獨立金鑰驗證）
    if (payload && payload.source === 'drms-bridge') {
      return handleBridge(payload);
    }

    // 1. LINE Webhook：請求驗證（fail-closed）
    if (!verifyRequest(e, body)) {
      return respond(403, 'Unauthorized webhook request');
    }

    var events = payload.events || [];
    events.forEach(function(event) {
      try {
        dispatch(event);
      } catch(err) {
        logError('dispatch error', err.toString(), event);
      }
    });

    return respond(200, 'OK');

  } catch(err) {
    logError('doPost error', err.toString(), {});
    return respond(500, err.toString());
  }
}

// ── 健康檢查：GET ?action=health 回報設定狀態（只回布林，不洩漏金鑰）──
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'health') {
    var acts = [];
    for (var k in ACTION) acts.push(ACTION[k]);
    return respondJson({
      ok: true, service: 'tc-drms-line-gas', version: 'v2',
      line:     { hasToken: !!CFG.CHANNEL_TOKEN, hasSecret: !!CFG.CHANNEL_SECRET, hasWebhookToken: !!CFG.WEBHOOK_TOKEN },
      bridge:   { enabled: !!CFG.BRIDGE_KEY },
      sheets:   { configured: !!CFG.SHEET_ID },
      firebase: { configured: !!CFG.FIREBASE_URL },
      actions:  acts,
      time: new Date().toISOString()
    });
  }
  return respondJson({ ok: true, service: 'tc-drms-line-gas',
    hint: 'GET ?action=health 檢查設定；POST 供 LINE Webhook 與 DRMS 橋接使用' });
}

// ── 請求驗證（fail-closed）──
// GAS Web App 讀不到 HTTP header，LINE 的 X-Line-Signature 實際上拿不到（e.parameter 只有
// query string）。因此驗證順序：
//   1. 有帶簽名（query 或未來遷移真伺服器）→ 嚴格 HMAC 驗證
//   2. 設了 WEBHOOK_TOKEN → 核對 Webhook URL 上的 ?token=（LINE 會原樣帶回 query string）
//   3. 都沒有 → 僅當 ALLOW_UNSIGNED='true'（開發環境）才放行，否則拒收
function verifyRequest(e, body) {
  var signature = (e.parameter && e.parameter['X-Line-Signature']) || getHeader(e, 'X-Line-Signature');

  if (signature) return verifySignature(body, signature);

  if (CFG.WEBHOOK_TOKEN) {
    var token = (e.parameter && e.parameter.token) || '';
    if (token === CFG.WEBHOOK_TOKEN) return true;
    logWarn('Webhook token 不符，拒收');
    return false;
  }

  if (String(CFG.ALLOW_UNSIGNED) === 'true') {
    logWarn('未驗證請求放行（ALLOW_UNSIGNED=true，僅限開發環境）');
    return true;
  }
  logWarn('無簽名、未設 WEBHOOK_TOKEN 且未開 ALLOW_UNSIGNED，拒收（fail-closed）');
  return false;
}

// ── HMAC-SHA256 簽名驗證 ──
function verifySignature(body, signature) {
  if (!signature) return false;
  if (!CFG.CHANNEL_SECRET) {
    logWarn('收到簽名但 CHANNEL_SECRET 未設定，無法驗證，拒收');
    return false;
  }
  var digest = Utilities.computeHmacSha256Signature(
    Utilities.newBlob(body).getBytes(),
    Utilities.newBlob(CFG.CHANNEL_SECRET).getBytes()
  );
  var expected = Utilities.base64Encode(digest);
  return expected === signature;
}

// ── DRMS 網頁橋接：模擬器動作直達後端（fail-closed：必須設 BRIDGE_KEY 且相符）──
var BRIDGE_CTX = null; // 橋接回覆收集器（push.gs 的 replyText/replyFlex 在無 replyToken 時寫入）

function handleBridge(payload) {
  if (!CFG.BRIDGE_KEY) {
    return respondJson({ ok: false, error: 'bridge disabled（Script Properties 未設 BRIDGE_KEY）' });
  }
  if (String(payload.key || '') !== String(CFG.BRIDGE_KEY)) {
    return respondJson({ ok: false, error: 'bad bridge key' });
  }

  var action = String(payload.action || '');
  var p      = payload.params || {};
  var uid    = String(payload.uid || 'drms-web');
  var ts     = new Date().toLocaleString('zh-TW');

  BRIDGE_CTX = { replies: [] };
  try {
    var handled = routeBridgeAction(action, uid, p, ts);
    if (!handled) return respondJson({ ok: false, error: 'unknown action: ' + action });
    writeLog('橋接:' + action, uid, JSON.stringify(p).slice(0, 180), ts);
    return respondJson({ ok: true, action: action, replies: BRIDGE_CTX.replies });
  } catch(err) {
    logError('handleBridge', err.toString(), { action: action });
    return respondJson({ ok: false, error: err.toString() });
  } finally {
    BRIDGE_CTX = null;
  }
}

// 橋接動作路由：共用 handlers.gs 的 routeAction；另收橋接限定動作（廣播/點名/推卡）
function routeBridgeAction(action, uid, p, ts) {
  // 與 LINE postback 共用的動作（token=null → 回覆進 BRIDGE_CTX.replies）
  if (routeAction(action, { token: null, userId: uid, params: p })) return true;

  // ── 橋接限定動作 ──
  if (action === 'broadcast') {
    // 訊息成本紀律（INFO_CHAIN_ADOPTION P1）：不打 LINE broadcast API；
    // 有指名對象（params.to = userId 陣列）才逐一 narrowcast push，否則只留紀錄
    rtdbPush('broadcasts', { target: p.target || '', msg: p.msg || '', by: uid, time: ts });
    if (p.to && p.to.length) {
      for (var i = 0; i < p.to.length; i++) pushText(p.to[i], '📢 ' + (p.msg || ''));
    }
    return true;
  }
  if (action === 'rollcall_fire') {
    rtdbWrite('rollcall', { active: true, firedBy: uid, time: ts });
    if (p.to && p.to.length) {
      for (var j = 0; j < p.to.length; j++) pushFlex(p.to[j], buildRollcallFlex(), '安全點名');
    }
    return true;
  }
  if (action === 'push_task') {
    rtdbPush('push_log', { type: 'task', id: p.id || '', title: p.title || '', assign: p.assign || '', by: uid, time: ts });
    if (p.to) pushFlex(p.to, buildTaskFlex({ id: p.id, title: p.title, assign: p.assign, endTime: p.endTime, status: 'pending' }), '任務指派');
    return true;
  }
  return false;
}

// ── 事件分派 ──
function dispatch(event) {
  var type = event.type;
  if      (type === 'message')  handleMessage(event);
  else if (type === 'postback') handlePostback(event);
  else if (type === 'follow')   handleFollow(event);
  // join / leave / memberJoined 暫不處理
}

// ── 工具：取 header（GAS e.parameter 不一定帶 header）──
function getHeader(e, name) {
  try {
    return e.parameter[name] || '';
  } catch(err) {
    return '';
  }
}

function respond(code, msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: code, message: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

function respondJson(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
