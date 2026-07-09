#!/usr/bin/env node
/**
 * TC-DRMS  gas/ 後端測試套件（Node vm 沙箱模擬 GAS 執行環境）
 *
 * 覆蓋範圍：
 *   - webhook.gs：doPost 驗證策略（fail-closed / WEBHOOK_TOKEN / HMAC / ALLOW_UNSIGNED）
 *   - webhook.gs：DRMS 橋接（BRIDGE_KEY 驗證、22 ACTION + 橋接限定動作路由）
 *   - handlers.gs：postback 統一路由 routeAction、關鍵字路由（開伙/交接/受阻）
 *   - push.gs：橋接模式回覆收集、Flex 卡（接單/覆核）postback data
 *   - sheets.gs：Sheets appendRow / Firebase REST 寫入路徑
 *
 * GAS 全域 API（PropertiesService/Utilities/UrlFetchApp/SpreadsheetApp/ContentService）
 * 以最小 mock 實作；每組測試可用不同 Script Properties 重建全新 context。
 *
 * Run:  node test_gas_handlers.js
 */

const fs     = require('fs');
const vm     = require('vm');
const path   = require('path');
const crypto = require('crypto');

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const G='\x1b[32m', R='\x1b[31m', B='\x1b[34m', DIM='\x1b[2m', RST='\x1b[0m';
let FAILURES = 0;
const pass  = msg => console.log(`  ${G}✓${RST} ${msg}`);
const fail  = msg => { console.log(`  ${R}✗${RST} ${msg}`); FAILURES++; };
const section = t => console.log(`\n${B}${t}${RST}`);
function assert(cond, label) { if (cond) pass(label); else fail(label); }

// ─── GAS 環境 mock 工廠 ───────────────────────────────────────────────────────
const GAS_FILES = ['config.gs','webhook.gs','handlers.gs','push.gs','sheets.gs']
  .map(f => fs.readFileSync(path.join(__dirname,'gas',f),'utf8')).join('\n;\n');

function makeGasContext(props) {
  props = props || {};
  const calls = { urlfetch: [], sheetRows: {}, warns: [], errors: [] };

  const fakeSheets = {}; // name -> rows[]
  function getSheet(name){ return fakeSheets[name] ? sheetApi(name) : null; }
  function sheetApi(name){
    return {
      appendRow: row => { (calls.sheetRows[name]=calls.sheetRows[name]||[]).push(row); fakeSheets[name].push(row); },
      getDataRange: () => ({ getValues: () => fakeSheets[name] }),
    };
  }

  const sandbox = {
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null) }),
    },
    Utilities: {
      newBlob: s => ({ getBytes: () => Array.from(Buffer.from(String(s),'utf8')) }),
      computeHmacSha256Signature: (bodyBytes, keyBytes) =>
        Array.from(crypto.createHmac('sha256', Buffer.from(keyBytes)).update(Buffer.from(bodyBytes)).digest()),
      base64Encode: bytes => Buffer.from(bytes).toString('base64'),
    },
    UrlFetchApp: {
      fetch: (url, options) => {
        calls.urlfetch.push({ url, options: options||{} });
        return { getResponseCode: () => 200, getContentText: () => '{}' };
      },
    },
    SpreadsheetApp: {
      openById: id => ({
        getSheetByName: name => getSheet(name),
        insertSheet:    name => { fakeSheets[name]=fakeSheets[name]||[]; return sheetApi(name); },
      }),
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: str => ({ _str: str, setMimeType(){ return this; }, getContent(){ return this._str; } }),
    },
    console: {
      log:   ()=>{},
      warn:  m => calls.warns.push(String(m)),
      error: m => calls.errors.push(String(m)),
    },
  };
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(GAS_FILES, sandbox);
  sandbox.__seedSheet = (name, rows) => { fakeSheets[name] = rows; };
  return { gas: sandbox, calls };
}

// ─── 輔助 ────────────────────────────────────────────────────────────────────
function lineEvent(payload, params) {
  return { postData: { contents: JSON.stringify(payload) }, parameter: params || {} };
}
function bridgePost(gas, body) {
  return JSON.parse(gas.doPost({ postData: { contents: JSON.stringify(body) }, parameter: {} }).getContent());
}
function hmacSign(body, secret) {
  return crypto.createHmac('sha256', Buffer.from(secret,'utf8')).update(Buffer.from(body,'utf8')).digest('base64');
}
const MSG = (text) => ({ events: [{ type:'message', replyToken:'RT-1', source:{userId:'U-TEST'}, message:{ type:'text', text } }] });
const PB  = (data) => ({ events: [{ type:'postback', replyToken:'RT-1', source:{userId:'U-TEST'}, postback:{ data } }] });

console.log(`\nTC-DRMS gas/ 後端測試套件`);
console.log(`${DIM}Loading gas/*.gs (${GAS_FILES.length} bytes)...${RST}`);

// ══════════════════════════════════════════════════════════════════════════════
section('[G1] gas 載入 — CFG / ACTION / 路由函式存在');
{
  const { gas } = makeGasContext();
  assert(typeof gas.CFG==='object', 'CFG 存在');
  assert(typeof gas.ACTION==='object', 'ACTION 存在');
  assert(Object.keys(gas.ACTION).length===22, 'ACTION 共 22 個（8 核心 + 14 新增）');
  ['doPost','doGet','verifyRequest','verifySignature','handleBridge','routeBridgeAction','routeAction',
   'handleSquadAccept','handleSquadRollcall','handleSquadReport','handleSquadBlocked','handleHandover',
   'handleDepart','handleMealCount','handleMealDone',
   'handleVisitStart','handleVisitDone','handleAidRequest','handlePsychRefer',
   'handleRiskApprove','handleCaseClose',
   'buildSquadTaskFlex','buildRiskReviewFlex']
    .forEach(fn => assert(typeof gas[fn]==='function', fn+'() 存在'));
}

section('[G2] 驗證 fail-closed — 無簽名/無 token/未開 ALLOW_UNSIGNED 一律 403');
{
  const { gas } = makeGasContext({}); // 什麼都沒設（出廠狀態）
  const res = JSON.parse(gas.doPost(lineEvent(MSG('安全'))).getContent());
  assert(res.status===403, '出廠狀態拒收 LINE webhook（不再像舊版直接放行）');
}

section('[G3] ALLOW_UNSIGNED=true（開發模式）— 放行並實際分派');
{
  const { gas, calls } = makeGasContext({ ALLOW_UNSIGNED:'true', FIREBASE_URL:'https://fake-rtdb.test' });
  const res = JSON.parse(gas.doPost(lineEvent(MSG('安全'))).getContent());
  assert(res.status===200, '開發模式放行');
  assert(calls.warns.some(w=>w.includes('ALLOW_UNSIGNED')), '放行時留下警告紀錄');
  assert(calls.urlfetch.some(c=>c.url.includes('/safety/U-TEST.json')), '「安全」訊息寫入 Firebase safety 節點');
}

section('[G4] WEBHOOK_TOKEN 補償控制 — GAS 讀不到 header 的替代驗證');
{
  const { gas } = makeGasContext({ WEBHOOK_TOKEN:'tk-secret' });
  let res = JSON.parse(gas.doPost(lineEvent(MSG('安全'), { token:'tk-secret' })).getContent());
  assert(res.status===200, 'URL ?token= 正確 → 放行');
  res = JSON.parse(gas.doPost(lineEvent(MSG('安全'), { token:'wrong' })).getContent());
  assert(res.status===403, 'token 錯誤 → 拒收');
  res = JSON.parse(gas.doPost(lineEvent(MSG('安全'))).getContent());
  assert(res.status===403, '未帶 token → 拒收');
}

section('[G5] HMAC-SHA256 驗簽 — 簽名可用時嚴格驗證');
{
  const { gas } = makeGasContext({ LINE_CHANNEL_SECRET:'chan-secret' });
  const body = JSON.stringify(MSG('安全'));
  const sig  = hmacSign(body, 'chan-secret');
  let res = JSON.parse(gas.doPost({ postData:{contents:body}, parameter:{'X-Line-Signature':sig} }).getContent());
  assert(res.status===200, '正確簽名 → 放行');
  res = JSON.parse(gas.doPost({ postData:{contents:body}, parameter:{'X-Line-Signature':'bad-sig'} }).getContent());
  assert(res.status===403, '錯誤簽名 → 拒收');
}

section('[G6] 橋接 fail-closed — 未設 BRIDGE_KEY 或金鑰錯誤一律拒絕');
{
  const noKey = makeGasContext({});
  let res = bridgePost(noKey.gas, { source:'drms-bridge', key:'anything', action:'safe', params:{} });
  assert(res.ok===false && String(res.error).includes('BRIDGE_KEY'), '未設 BRIDGE_KEY → 橋接停用');

  const withKey = makeGasContext({ BRIDGE_KEY:'bk-1' });
  res = bridgePost(withKey.gas, { source:'drms-bridge', key:'wrong', action:'safe', params:{} });
  assert(res.ok===false && String(res.error).includes('bad bridge key'), '金鑰錯誤 → 拒絕');
}

section('[G7] 橋接 checkin — 走完整 handler：回覆收集 + Sheets + Firebase');
{
  const { gas, calls } = makeGasContext({ BRIDGE_KEY:'bk-1', SHEET_ID:'FAKE', FIREBASE_URL:'https://fake-rtdb.test' });
  const res = bridgePost(gas, { source:'drms-bridge', key:'bk-1', action:'checkin', params:{ email:'' }, uid:'drms-web' });
  assert(res.ok===true && res.action==='checkin', '橋接 checkin 回 ok:true');
  assert(Array.isArray(res.replies) && res.replies.length>0 && res.replies[0].includes('報到成功'), '後端回覆文字進 replies（模擬器可顯示）');
  assert((calls.sheetRows['事件紀錄']||[]).some(r=>String(r[0])==='報到'), 'Sheets 事件紀錄收到報到列');
  assert(calls.urlfetch.some(c=>c.url.includes('/checkins/')), 'Firebase checkins 節點寫入');
  assert((calls.sheetRows['事件紀錄']||[]).some(r=>String(r[0]).indexOf('橋接:')===0), '橋接來源留稽核（橋接:checkin）');
}

section('[G8] 橋接 × 25 動作全路由 — 22 ACTION + 3 橋接限定，逐一 ok:true');
{
  const PARAMS = {
    checkin:{email:''}, safe:{}, sos:{detail:'測試'}, task_done:{id:'T-1'}, supply_recv:{req:'R-1'},
    supply_start:{}, supply_item:{item:'白米'}, supply_qty:{item:'白米',qty:'×10',site:'現場'},
    squad_accept:{id:'T-1',decision:'accept',squad:'SQ-01'}, squad_rollcall:{squad:'SQ-01'},
    squad_report:{id:'T-1',pct:'50',note:'順利'}, squad_blocked:{id:'T-1',reason:'怪手無法進場'},
    handover:{squad:'SQ-01',note:'快照'}, depart:{req:'R-1'},
    meal_count:{count:'80',site:'香積站'}, meal_done:{count:'80',site:'香積站'},
    visit_start:{caseId:'C-1'}, visit_done:{caseId:'C-1',note:'關懷'}, aid_request:{caseId:'C-1'}, psych_refer:{caseId:'C-1'},
    risk_approve:{id:'T-1',decision:'approve'}, case_close:{caseId:'C-1'},
    broadcast:{target:'全部志工',msg:'測試廣播'}, rollcall_fire:{}, push_task:{id:'T-1',title:'測試任務'},
  };
  const { gas } = makeGasContext({ BRIDGE_KEY:'bk-1', FIREBASE_URL:'https://fake-rtdb.test' });
  let allOk = true;
  Object.keys(PARAMS).forEach(action => {
    const res = bridgePost(gas, { source:'drms-bridge', key:'bk-1', action, params:PARAMS[action] });
    if (!res.ok) { allOk=false; fail('action '+action+' 失敗：'+res.error); }
  });
  if (allOk) pass('25 個動作全部路由成功（無 unknown action）');
  const bad = bridgePost(gas, { source:'drms-bridge', key:'bk-1', action:'not_exist', params:{} });
  assert(bad.ok===false && String(bad.error).includes('unknown action'), '未知動作明確回報 unknown action');
}

section('[G9] LINE postback 路由 — 接單狀態機 accepted / declined');
{
  const { gas, calls } = makeGasContext({ ALLOW_UNSIGNED:'true', FIREBASE_URL:'https://fake-rtdb.test' });
  gas.doPost(lineEvent(PB('action=squad_accept&id=T-9&decision=accept')));
  const acceptWrite = calls.urlfetch.find(c=>c.url.includes('/assignments/T-9.json'));
  assert(!!acceptWrite, 'postback squad_accept 寫 assignments/T-9');
  assert(acceptWrite && JSON.parse(acceptWrite.options.payload).status==='accepted', '狀態機 status=accepted');
  assert(calls.urlfetch.some(c=>c.url.includes('/tasks/T-9/status.json') && JSON.parse(c.options.payload)==='進行中'), '任務轉進行中');

  calls.urlfetch.length = 0;
  gas.doPost(lineEvent(PB('action=squad_accept&id=T-9&decision=decline')));
  const declineWrite = calls.urlfetch.find(c=>c.url.includes('/assignments/T-9.json'));
  assert(declineWrite && JSON.parse(declineWrite.options.payload).status==='declined', '婉拒 → status=declined');
  assert(calls.urlfetch.some(c=>c.url.includes('/tasks/T-9/status.json') && JSON.parse(c.options.payload)==='待派工'), '任務退回待派池');
}

section('[G10] 關鍵字路由 — 開伙 / 交接 / 受阻（前線免選單快捷輸入）');
{
  const { gas, calls } = makeGasContext({ ALLOW_UNSIGNED:'true', FIREBASE_URL:'https://fake-rtdb.test' });
  gas.doPost(lineEvent(MSG('開伙 120')));
  const kitchenWrite = calls.urlfetch.find(c=>c.url.includes('/kitchen/'));
  assert(!!kitchenWrite, '「開伙 120」→ kitchen 節點');
  assert(kitchenWrite && JSON.parse(kitchenWrite.options.payload).mealsToday===120, 'mealsToday=120');

  gas.doPost(lineEvent(MSG('交接：現場已清運完畢')));
  const handoverWrite = calls.urlfetch.find(c=>c.url.includes('/handover_log.json'));
  assert(handoverWrite && JSON.parse(handoverWrite.options.payload).note==='現場已清運完畢', '「交接：」→ handover_log 帶摘要');

  gas.doPost(lineEvent(MSG('受阻：道路中斷')));
  const alertWrite = calls.urlfetch.find(c=>c.url.includes('/alerts.json'));
  assert(alertWrite && JSON.parse(alertWrite.options.payload).reason==='道路中斷', '「受阻：」→ alerts 帶原因');
}

section('[G11] 廣播成本紀律 — 無指名對象不打 LINE API，有對象走 narrowcast push');
{
  const { gas, calls } = makeGasContext({ BRIDGE_KEY:'bk-1', LINE_CHANNEL_TOKEN:'tok-1', FIREBASE_URL:'https://fake-rtdb.test' });
  bridgePost(gas, { source:'drms-bridge', key:'bk-1', action:'broadcast', params:{ target:'全部志工', msg:'hi' } });
  assert(!calls.urlfetch.some(c=>c.url.includes('api.line.me')), '無 params.to → 只留紀錄，不打 LINE API（INFO_CHAIN P1）');
  assert(calls.urlfetch.some(c=>c.url.includes('/broadcasts.json')), '廣播內容寫 Firebase broadcasts 稽核');

  bridgePost(gas, { source:'drms-bridge', key:'bk-1', action:'broadcast', params:{ target:'指名', msg:'hi', to:['U-1','U-2'] } });
  const pushes = calls.urlfetch.filter(c=>c.url==='https://api.line.me/v2/bot/message/push');
  assert(pushes.length===2, '有 params.to → 逐一 narrowcast push（2 位）');
}

section('[G12] Flex 卡片 — 接單卡 / 覆核卡的 postback data 正確');
{
  const { gas } = makeGasContext({});
  const squadCard = JSON.stringify(gas.buildSquadTaskFlex({ id:'T-5', title:'倒木清除', priority:'P1', site:'竹崎' }));
  assert(squadCard.includes('action=squad_accept&id=T-5&decision=accept'), '接單卡含接單 postback');
  assert(squadCard.includes('action=squad_accept&id=T-5&decision=decline'), '接單卡含婉拒 postback');
  const riskCard = JSON.stringify(gas.buildRiskReviewFlex({ id:'T-6', title:'高風險搶救' }));
  assert(riskCard.includes('action=risk_approve&id=T-6&decision=approve'), '覆核卡含核准 postback');
  assert(riskCard.includes('action=risk_approve&id=T-6&decision=reject'), '覆核卡含駁回 postback');
}

section('[G13] doGet health — 只回布林設定狀態，不洩漏金鑰');
{
  const { gas } = makeGasContext({ BRIDGE_KEY:'bk-secret-value', LINE_CHANNEL_TOKEN:'tok-secret' });
  const raw = gas.doGet({ parameter:{ action:'health' } }).getContent();
  const h = JSON.parse(raw);
  assert(h.ok===true && h.bridge.enabled===true && h.line.hasToken===true, 'health 回報設定狀態');
  assert(h.actions.length===22, 'health 列出 22 個 ACTION');
  assert(!raw.includes('bk-secret-value') && !raw.includes('tok-secret'), '回應不含任何金鑰明文');
}

// ══════════════════════════════════════════════════════════════════════════════
console.log('\n' + '─'.repeat(60));
if (FAILURES === 0) {
  console.log(G + 'All gas/ tests passed ✓' + RST + '\n');
  process.exit(0);
} else {
  console.log(R + FAILURES + ' test(s) FAILED — see ✗ lines above' + RST + '\n');
  process.exit(1);
}
