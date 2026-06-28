// ══════════════════════════════════════════════════════
//  push.gs — 推播工具（回覆 + 主動推播 + Flex Message 建構）
// ══════════════════════════════════════════════════════

// ── 基本回覆（文字）──
function replyText(replyToken, text) {
  callLineAPI(LINE_REPLY_URL, {
    replyToken: replyToken,
    messages: [{ type: 'text', text: text }]
  });
}

// ── 基本回覆（Flex）──
function replyFlex(replyToken, container) {
  callLineAPI(LINE_REPLY_URL, {
    replyToken: replyToken,
    messages: [{ type: 'flex', altText: '請查看訊息', contents: container }]
  });
}

// ── 主動推播（不需 replyToken，可在任意時間送）──
function pushText(userId, text) {
  callLineAPI(LINE_PUSH_URL, {
    to: userId,
    messages: [{ type: 'text', text: text }]
  });
}

function pushFlex(userId, container, altText) {
  callLineAPI(LINE_PUSH_URL, {
    to: userId,
    messages: [{ type: 'flex', altText: altText || '請查看訊息', contents: container }]
  });
}

// ── 任務卡（推播給組長）──
function buildTaskFlex(task) {
  var statusColor = task.status === 'done' ? '#06C755'
                  : task.status === 'active' ? '#3B82F6' : '#F59E0B';
  return {
    type: 'bubble',
    header: flexBox('horizontal', [
      flexText('🎯 任務指派', { weight: 'bold', color: '#ffffff', size: 'md' })
    ], { backgroundColor: '#1e3a5f', paddingAll: '12px' }),
    body: flexBox('vertical', [
      flexText(task.id + '　' + task.title, { weight: 'bold', wrap: true }),
      flexSep(),
      flexBox('horizontal', [
        flexText('負責組別', { size: 'sm', color: '#888888', flex: 2 }),
        flexText(task.assign || '—', { size: 'sm', flex: 3 })
      ]),
      flexBox('horizontal', [
        flexText('截止時間', { size: 'sm', color: '#888888', flex: 2 }),
        flexText(task.endTime || '—', { size: 'sm', color: '#EF4444', flex: 3 })
      ]),
      flexBox('horizontal', [
        flexText('狀態', { size: 'sm', color: '#888888', flex: 2 }),
        flexText(task.status === 'done' ? '完成' : task.status === 'active' ? '進行中' : '待處理',
                 { size: 'sm', color: statusColor, flex: 3 })
      ]),
    ]),
    footer: flexBox('vertical', [
      task.status !== 'done'
        ? flexButton('✅ 任務完工', 'postback', 'action=task_done&id=' + task.id, '#06C755')
        : flexText('已完成', { size: 'sm', color: '#06C755', align: 'center' })
    ])
  };
}

// ── 配送單（推播給司機）──
function buildDeliveryFlex(req) {
  var prioColor = req.prio === 'P1' ? '#EF4444' : req.prio === 'P2' ? '#F59E0B' : '#6B7280';
  return {
    type: 'bubble',
    header: flexBox('horizontal', [
      flexText('🚛 配送指令', { weight: 'bold', color: '#ffffff', size: 'md' }),
      flexText(req.prio || 'P3', { weight: 'bold', color: prioColor, size: 'md', align: 'end' })
    ], { backgroundColor: '#1a1a2e', paddingAll: '12px' }),
    body: flexBox('vertical', [
      flexBox('horizontal', [
        flexText('單號', { size: 'sm', color: '#888888', flex: 2 }),
        flexText(req.id, { size: 'sm', flex: 3, weight: 'bold' })
      ]),
      flexBox('horizontal', [
        flexText('品項', { size: 'sm', color: '#888888', flex: 2 }),
        flexText(req.item + ' ' + (req.qty || ''), { size: 'sm', flex: 3 })
      ]),
      flexBox('horizontal', [
        flexText('送達地點', { size: 'sm', color: '#888888', flex: 2 }),
        flexText(req.site, { size: 'sm', flex: 3 })
      ]),
      flexBox('horizontal', [
        flexText('時限', { size: 'sm', color: '#888888', flex: 2 }),
        flexText(req.due || '盡快', { size: 'sm', color: '#EF4444', flex: 3 })
      ]),
    ]),
    footer: flexBox('vertical', [
      flexButton('✅ 已到貨', 'postback', 'action=supply_recv&req=' + req.id, '#06C755')
    ])
  };
}

// ── 安全點名推播（廣播給所有志工）──
function buildRollcallFlex() {
  return {
    type: 'bubble',
    header: flexBox('horizontal', [
      flexText('📡 安全點名', { weight: 'bold', color: '#ffffff', size: 'lg' })
    ], { backgroundColor: '#EF4444', paddingAll: '14px' }),
    body: flexBox('vertical', [
      flexText('請立即確認您的安全狀況並回報！', { wrap: true, size: 'sm', color: '#333333' })
    ]),
    footer: flexBox('horizontal', [
      flexButton('✅ 我安全', 'postback', 'action=safe', '#06C755'),
      flexButton('🆘 求救',   'postback', 'action=sos',  '#EF4444'),
    ])
  };
}

// ────────────────────────────────
//  Flex Message 元件建構 helpers
// ────────────────────────────────
function flexBox(layout, contents, extra) {
  var obj = { type: 'box', layout: layout, contents: contents };
  if (extra) Object.keys(extra).forEach(function(k){ obj[k] = extra[k]; });
  return obj;
}

function flexText(text, extra) {
  var obj = { type: 'text', text: text };
  if (extra) Object.keys(extra).forEach(function(k){ obj[k] = extra[k]; });
  return obj;
}

function flexButton(label, actionType, data, color) {
  return {
    type: 'button',
    style: 'primary',
    color: color || '#1DB446',
    margin: 'sm',
    action: actionType === 'postback'
      ? { type: 'postback', label: label, data: data }
      : { type: 'uri',      label: label, uri: data }
  };
}

function flexSep() {
  return { type: 'separator', margin: 'md' };
}

// ────────────────────────────────
//  Line API 呼叫
// ────────────────────────────────
function callLineAPI(url, payload) {
  if (!CFG.CHANNEL_TOKEN) {
    logWarn('CHANNEL_TOKEN 未設定，跳過推播');
    return;
  }
  var options = {
    method: 'POST',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + CFG.CHANNEL_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  var res = UrlFetchApp.fetch(url, options);
  if (res.getResponseCode() !== 200) {
    logError('Line API error', res.getContentText(), { url: url });
  }
  return res;
}
