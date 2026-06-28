// ══════════════════════════════════════════════════════
//  webhook.gs — Line Webhook 主入口
//  Line Developers Console → Webhook URL 填此 /exec 網址
// ══════════════════════════════════════════════════════

function doPost(e) {
  try {
    var body = e.postData.contents;

    // 1. 驗證簽名（防偽造請求）
    if (!verifySignature(body, e.parameter['X-Line-Signature'] || getHeader(e, 'X-Line-Signature'))) {
      return respond(403, 'Invalid signature');
    }

    var payload = JSON.parse(body);
    var events  = payload.events || [];

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

// ── 簽名驗證 ──
function verifySignature(body, signature) {
  if (!signature) return false;
  if (!CFG.CHANNEL_SECRET) {
    // Secret 未設定時跳過驗證（開發用，正式上線前務必設定）
    logWarn('CHANNEL_SECRET 未設定，跳過驗簽');
    return true;
  }
  var digest = Utilities.computeHmacSha256Signature(
    Utilities.newBlob(body).getBytes(),
    Utilities.newBlob(CFG.CHANNEL_SECRET).getBytes()
  );
  var expected = Utilities.base64Encode(digest);
  return expected === signature;
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
