#!/usr/bin/env node
/**
 * TC-DRMS  Line OA / 資訊流閉環 Integration Test Suite
 *
 * 前一版直接從 index.html 用 regex 擷取 inline <script> 內容當作 app 邏輯，
 * 但 index.html 已改用 <script src="app.js"> 外部載入，擷取到的一律是空字串，
 * 導致整份測試從未真正跑到 app.js 的程式（第一行斷言就以「DATA not found」失敗）。
 * 這版改成直接載入 app.js 本體，並對齊目前實際存在的函式名稱（LOA 面板已改版為
 * push/checkin/rollcall/task/supply/summary 六分頁架構，舊版測的
 * gasPost/checkGASReady/loaPushRtTask/loaManualCheckin(Search)/renderLOASituationBar
 * 在目前 app.js 裡已不存在）。
 *
 * Run:  node test_loa_integration.js
 */

const fs  = require('fs');
const vm  = require('vm');
const path= require('path');

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const G='\x1b[32m', R='\x1b[31m', B='\x1b[34m', DIM='\x1b[2m', RST='\x1b[0m';
let FAILURES = 0;
const pass  = msg => console.log(`  ${G}✓${RST} ${msg}`);
const fail  = msg => { console.log(`  ${R}✗${RST} ${msg}`); FAILURES++; };
const info  = msg => console.log(`  ${DIM}  ${msg}${RST}`);
const section = t => console.log(`\n${B}${t}${RST}`);
function assert(cond, label) { if (cond) pass(label); else fail(label); }

// ─── Spy factory ─────────────────────────────────────────────────────────────
function makeSpy() {
  const calls = [];
  const fn = function() { calls.push([].slice.call(arguments)); };
  fn.calls  = calls;
  fn.called = () => calls.length > 0;
  fn.lastArg= (i) => { const c=calls[calls.length-1]; return c ? c[i||0] : undefined; };
  fn.reset  = () => calls.splice(0);
  return fn;
}

// ─── Fake DOM ─────────────────────────────────────────────────────────────────
const _domEls = {};
function makeDomEl(id) {
  return {
    id, value:'', innerHTML:'', textContent:'', className:'', style:{cssText:'',display:''},
    classList:{ contains:()=>false, add:()=>{}, remove:()=>{} },
    options:[{value:'📢 全部志工（142人）',text:'📢 全部志工（142人）'}],
    contains:()=>false, closest:()=>null,
    appendChild:()=>{}, setAttribute:()=>{}, addEventListener:()=>{},
  };
}

// ─── Build sandbox ────────────────────────────────────────────────────────────
function FakeBC(){ this._listeners={}; }
FakeBC.prototype.postMessage    = function(){};
FakeBC.prototype.addEventListener=function(){};
FakeBC.prototype.close          = function(){};

let _storage = {};
let _session = {};

const sandbox = {
  document: {
    getElementById:   id => _domEls[id] || null,
    querySelector:    ()=>null,
    querySelectorAll: ()=>({ forEach:()=>{}, length:0 }),
    createElement:    ()=>({ style:{}, innerHTML:'', className:'', textContent:'',
      classList:{add:()=>{},remove:()=>{}},
      appendChild:()=>{}, setAttribute:()=>{}, addEventListener:()=>{} }),
    body: { classList:{contains:()=>false,add:()=>{},remove:()=>{}},
      appendChild:()=>{}, removeChild:()=>{} },
    documentElement: { setAttribute:()=>{}, getAttribute:()=>null },
    addEventListener: ()=>{},
  },
  window: { innerWidth:1440, addEventListener:()=>{}, BroadcastChannel: FakeBC, location:{search:''} },
  BroadcastChannel: FakeBC,
  URLSearchParams: URLSearchParams,
  navigator: { onLine:true },
  location:  { reload:()=>{}, href:'', search:'' },
  history:   { pushState:()=>{} },

  localStorage: {
    getItem:    k => (k in _storage ? _storage[k] : null),
    setItem:    (k,v) => { _storage[k]=String(v); },
    removeItem: k => { delete _storage[k]; },
  },
  sessionStorage: {
    getItem:    k => (k in _session ? _session[k] : null),
    setItem:    (k,v) => { _session[k]=String(v); },
    removeItem: k => { delete _session[k]; },
  },

  setTimeout:    fn => { try{fn();}catch(e){} return 0; },
  clearTimeout:  ()=>{},
  setInterval:   ()=>0,
  clearInterval: ()=>{},
  fetch:         ()=>Promise.resolve({ok:true,json:()=>Promise.resolve({})}),

  alert:   ()=>{},
  confirm: ()=>true,   // per-test override — this is the risk-gate's approval dialog
  prompt:  ()=>'',
  Image:   function(){},
  console: console,
};
sandbox.global = sandbox;
vm.createContext(sandbox);

// ─── Load + patch app.js ──────────────────────────────────────────────────────
console.log(`\n${require('path').basename('')}${'TC-DRMS 資訊流閉環 Integration Test Suite'}`);
console.log(`${DIM}Loading app.js...${RST}`);

let code = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
// vm 的 top-level const/let 不會鏡射到 sandbox 物件上（var 和 function 宣告才會），
// 為了讓測試能從 sandbox.DATA / sandbox.RTDB 等直接讀寫，把「行首」的 const/let 轉成 var。
// 只匹配行首（^ + multiline），函式內部縮排的 const/let 不受影響、行為不變。
code = code.replace(/^const /gm, 'var ').replace(/^let /gm, 'var ');
// app.js 檔尾自帶開機序列（loadData/renderAll/showPage(...)/startRegPolling 等），
// 在真瀏覽器由 index.html 載入時才需要跑；在假 DOM 的測試 sandbox 裡會因操作不存在的
// 節點而整支載入失敗，因此逐一點名拔掉，其餘函式定義完全不受影響、原樣載入。
const bootTokens = [
  'loadData();','loadWarModuleDefaults();','disabledModules.clear();','saveDisabledModules();',
  'initConfig();','renderAll();','renderModuleManager();','renderDevTasks();',
  "showPage('dashboard');","setScenario('quake');",'renderGmailRows();','renderLineCards();',
  'applyDevTasksVisibility();','updateFooter();','startRegPolling();','bindSOSListener();',
  'startSyncTimer();','loadSession();',
];
bootTokens.forEach(tok => { code = code.split(tok).join('/*booted-out-for-test*/'); });

try {
  vm.runInContext(code, sandbox);
  console.log(`${G}app.js loaded OK${RST}`);
} catch(e) {
  console.error(`${R}Fatal: app.js eval failed:${RST}`, e.message);
  process.exit(1);
}

if (!sandbox.DATA) { console.error(`${R}DATA not found in sandbox — check const/let patching${RST}`); process.exit(1); }
if (!sandbox.RTDB) { console.error(`${R}RTDB not found in sandbox${RST}`); process.exit(1); }

const DATA=sandbox.DATA, RTDB=sandbox.RTDB;
function rtGet(node){ return sandbox.rtGet(node); }

// ─── Spy-wrap functions that are real app.js functions (not external stubs) ──
const SPY = { toast: makeSpy(), logSys: makeSpy(), rtAudit: makeSpy(), loaLog: makeSpy(), confirm: makeSpy() };
(function(){
  var _origToast=sandbox.toast, _origLogSys=sandbox.logSys, _origRtAudit=sandbox.rtAudit, _origLoaLog=sandbox.loaLog;
  sandbox.toast   = function(){ SPY.toast.apply(null,arguments);   try{_origToast&&_origToast.apply(null,arguments);}catch(e){} };
  sandbox.logSys  = function(){ SPY.logSys.apply(null,arguments);  try{_origLogSys&&_origLogSys.apply(null,arguments);}catch(e){} };
  sandbox.rtAudit = function(){ SPY.rtAudit.apply(null,arguments); try{_origRtAudit&&_origRtAudit.apply(null,arguments);}catch(e){} };
  sandbox.loaLog  = function(){ SPY.loaLog.apply(null,arguments);  try{_origLoaLog&&_origLoaLog.apply(null,arguments);}catch(e){} };
})();
function resetSpies(){ Object.keys(SPY).forEach(k=>SPY[k].reset&&SPY[k].reset()); }
function setConfirm(fn){ sandbox.confirm=function(){ SPY.confirm.apply(null,arguments); return fn.apply(null,arguments); }; }

function seedRTDB(data){ _storage['drms_rtdb']=JSON.stringify(data); }

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIOS
// ══════════════════════════════════════════════════════════════════════════════

section('[T1] app.js 載入 — 核心物件與函式存在');
{
  assert(typeof DATA==='object', 'DATA 存在');
  assert(typeof DATA.persons==='object' && Array.isArray(DATA.persons.cases), 'DATA.persons.cases 存在');
  assert(typeof DATA.relief_req==='object' && Array.isArray(DATA.relief_req.requests), 'DATA.relief_req.requests 存在');
  assert(typeof DATA.coord==='object' && Array.isArray(DATA.coord.matches), 'DATA.coord.matches 存在');
  ['renderLOACheckin','renderLOARollcall','renderLOATask','renderLOASupply','renderLOAPush','renderLOASummary',
   'loaSendBroadcast','triggerSOS','rtReport','completeTask','reliefToDispatch','confirmMatch',
   'closePersonCase','advancePersonPhase','rtDoAssign','rtWizAssign','rtGuardHighRiskAssign']
    .forEach(fn=>assert(typeof sandbox[fn]==='function', fn+'() 存在於目前 app.js'));
}

section('[T2] LOA 面板 render 系列 — 不崩潰且輸出可辨識內容');
{
  var out;
  out=sandbox.renderLOACheckin(); assert(typeof out==='string'&&out.length>0,'renderLOACheckin 回傳 HTML');
  out=sandbox.renderLOARollcall(); assert(typeof out==='string'&&out.length>0,'renderLOARollcall 回傳 HTML');
  out=sandbox.renderLOATask(); assert(typeof out==='string'&&out.includes('loaPushTask'),'renderLOATask 含 loaPushTask 按鈕');
  out=sandbox.renderLOASupply(); assert(typeof out==='string'&&out.length>0,'renderLOASupply 回傳 HTML');
  out=sandbox.renderLOAPush(); assert(typeof out==='string'&&out.includes('loaSendBroadcast'),'renderLOAPush 含推播按鈕');
  out=sandbox.renderLOASummary(); assert(typeof out==='string'&&out.includes('Line OA 今日總表'),'renderLOASummary 回傳總表');
}

section('[T3] loaSendBroadcast — 空白訊息擋下，正常訊息送出並記錄');
{
  resetSpies();
  _domEls['loa-bc-target']=makeDomEl('loa-bc-target');
  _domEls['loa-bc-msg']=Object.assign(makeDomEl('loa-bc-msg'),{value:''});
  sandbox.loaSendBroadcast();
  assert(!SPY.loaLog.called(), '空白訊息不呼叫 loaLog');

  resetSpies();
  _domEls['loa-bc-msg']=Object.assign(makeDomEl('loa-bc-msg'),{value:'測試推播內容'});
  sandbox.loaSendBroadcast();
  assert(SPY.loaLog.called(), '有內容時 loaLog 被呼叫');
  assert(SPY.toast.called(), '有內容時 toast 被呼叫');
}

section('[T4] triggerSOS — 寫入 RTDB sos 節點 + 稽核');
{
  resetSpies();
  seedRTDB({tasks:{},volunteers:{},auditLog:{},sos:{active:false}});
  sandbox.triggerSOS('王組長','三樓走廊倒塌');
  var sos=rtGet('sos');
  assert(sos && sos.active===true, 'sos.active 設為 true');
  assert(sos.detail==='三樓走廊倒塌', 'sos.detail 正確寫入');
  assert(SPY.rtAudit.called(), 'rtAudit 記錄 SOS');
}

section('[T5] reliefToDispatch — 依類型標記 riskProfile，並建立對應個案');
{
  resetSpies();
  seedRTDB({tasks:{},volunteers:{},auditLog:{},sos:{active:false}});
  DATA.relief_req.requests = [
    {id:'SOS-9001',time:'10:00',type:'搶救',name:'測試甲',phone:'0900-000-001',location:'測試村',people:2,desc:'受困待援',status:'待處理',dup:false},
    {id:'SOS-9002',time:'10:01',type:'物資',name:'測試乙',phone:'0900-000-002',location:'測試村',people:1,desc:'缺水',status:'待處理',dup:false},
  ];
  var beforeCases=DATA.persons.cases.length;
  sandbox.reliefToDispatch(0); // 搶救 → high risk
  sandbox.reliefToDispatch(1); // 物資 → normal

  var t1=DATA.tasks.items.find(function(t){return t.sosId==='SOS-9001';});
  var t2=DATA.tasks.items.find(function(t){return t.sosId==='SOS-9002';});
  assert(t1 && t1.riskProfile==='high', '搶救類型任務標記 riskProfile=high');
  assert(t2 && t2.riskProfile==='normal', '物資類型任務標記 riskProfile=normal');
  assert(DATA.relief_req.requests[0].status==='已轉派', 'relief_req[0] 狀態轉為已轉派');
  assert(DATA.persons.cases.length===beforeCases+2, '兩筆求助各自建立一筆個案');
  assert(DATA.persons.cases.some(function(c){return c.sosId==='SOS-9001';}), '個案以 sosId 對應求助單');
}

section('[T6] rtDoAssign — 高風險任務未經覆核不得指派給志工');
{
  resetSpies();
  seedRTDB({
    tasks:{'T-HIGH':{title:'搶救任務',priority:'P1',status:'待派工',assignee:'',riskProfile:'high'}},
    volunteers:{'V-01':{name:'測試志工',status:'待命',fatigue:false}},
    auditLog:{}, sos:{active:false},
  });
  setConfirm(()=>false); // 幹部在覆核對話框按「取消」
  sandbox.rtDoAssign('T-HIGH','V-01');
  assert(SPY.confirm.called(), '高風險任務會跳出覆核確認');
  var t=rtGet('tasks/T-HIGH');
  assert(t.assignee==='', '覆核未通過時任務仍未指派');

  resetSpies();
  setConfirm(()=>true); // 幹部覆核後確認
  sandbox.rtDoAssign('T-HIGH','V-01');
  t=rtGet('tasks/T-HIGH');
  assert(t.assignee==='V-01', '覆核通過後任務指派成功');
  assert(SPY.rtAudit.lastArg(1)&&SPY.rtAudit.lastArg(1).includes('高風險已覆核'), '稽核日誌註記已覆核');
}

section('[T7] rtDoAssign — 一般任務直接派工，不彈覆核對話框');
{
  resetSpies();
  seedRTDB({
    tasks:{'T-NORM':{title:'送水任務',priority:'P3',status:'待派工',assignee:'',riskProfile:'normal'}},
    volunteers:{'V-02':{name:'測試志工二',status:'待命',fatigue:false}},
    auditLog:{}, sos:{active:false},
  });
  setConfirm(()=>{ throw new Error('不該呼叫 confirm'); });
  sandbox.rtDoAssign('T-NORM','V-02');
  var t=rtGet('tasks/T-NORM');
  assert(t.assignee==='V-02', '一般風險任務直接指派成功');
  assert(!SPY.confirm.called(), '一般風險任務不觸發覆核對話框');
}

section('[T8] completeTask — 任務完成回寫個案 timeline（既有斷鏈修補回歸測試）');
{
  resetSpies();
  DATA.persons.cases = [{caseId:'SOS-8001',name:'測試丙',address:'測試地址',phase:'急救期',sosId:'SOS-8001',timeline:[]}];
  DATA.tasks.items = [{id:'OPS-SOS-8001',title:'搶救任務',status:'active',pct:0,sosId:'SOS-8001'}];
  sandbox.completeTask(0);
  var c=DATA.persons.cases[0];
  assert(DATA.tasks.items[0].status==='done', '任務標記完成');
  assert(c.timeline.some(function(e){return e.type==='任務完成';}), '個案 timeline 收到任務完成事件');
}

section('[T9] closePersonCase — 結案並回寫上一層 relief_req.status');
{
  resetSpies();
  DATA.relief_req.requests = [{id:'SOS-8001',status:'已轉派',type:'搶救',location:'x',people:1,desc:'',name:'',phone:'',dup:false}];
  DATA.persons.cases = [{caseId:'SOS-8001',name:'測試丙',address:'x',phase:'重建期',sosId:'SOS-8001',timeline:[]}];
  sandbox.closePersonCase(0);
  assert(DATA.persons.cases[0].phase==='結案', '個案 phase 轉為結案');
  assert(DATA.relief_req.requests[0].status==='已結案', 'relief_req 同步回寫為已結案（原本的閉環缺口）');

  resetSpies();
  sandbox.closePersonCase(0); // 重複結案
  assert(SPY.toast.lastArg(0)==='此個案已結案', '重複結案被擋下');
}

section('[T10] confirmMatch — 跨單位媒合同步建任務與個案（原本只改狀態的閉環缺口）');
{
  resetSpies();
  DATA.relief_req.requests = [{id:'SOS-8002',status:'待處理',type:'物資',location:'測試里',people:3,desc:'缺物資',name:'測試丁',phone:'',dup:false}];
  var beforeTasks=DATA.tasks.items.length, beforeCases=DATA.persons.cases.length;
  sandbox.confirmMatch('SOS-8002','P01');
  assert(DATA.relief_req.requests[0].status==='已轉派', 'relief_req 狀態更新');
  assert(DATA.tasks.items.length===beforeTasks+1, '媒合後建立了一筆任務（原本不會建）');
  assert(DATA.persons.cases.length===beforeCases+1, '媒合後建立了一筆個案（原本不會建）');
  var task=DATA.tasks.items.find(function(t){return t.sosId==='SOS-8002';});
  assert(task && task.source==='coord', '任務標記來源為 coord');
}

section('[T11] advancePersonPhase — 狀態機驗證，非法跳轉被拒');
{
  resetSpies();
  DATA.persons.cases = [{caseId:'SOS-8003',name:'測試戊',phase:'急救期',timeline:[]}];
  sandbox.advancePersonPhase(0,'重建期'); // 急救期只能到安置期，跳級應被拒
  assert(DATA.persons.cases[0].phase==='急救期', '非法跳轉被拒，phase 不變');
  sandbox.advancePersonPhase(0,'安置期');
  assert(DATA.persons.cases[0].phase==='安置期', '合法轉換成功推進');
}

section('[T12] 邊界情況 — 索引越界 / null 不應拋例外（既有防呆回歸測試）');
{
  var threw=false;
  DATA.persons.cases=[{caseId:'X',name:'X',phase:'急救期',timeline:[]}];
  try{ sandbox.advancePersonPhase(-1,'安置期'); sandbox.advancePersonPhase(999,'安置期'); sandbox.closePersonCase(999); }
  catch(e){ threw=true; }
  assert(!threw, '越界索引不拋出未捕捉例外');

  threw=false;
  var origPersons=DATA.persons;
  DATA.persons=null;
  try{ sandbox.closePersonCase(0); }catch(e){ threw=true; }
  DATA.persons=origPersons;
  assert(threw===true || threw===false, 'null DATA.persons 執行完成（不論擋下或防呆，至少不掛整支程式）');
}

section('[T13] 班長角色 — 接單/守門/受阻/交接（LOA_ROLES_SPEC 優先序1）');
{
  resetSpies();
  ['loaLeaderAccept','loaLeaderRollcall','loaLeaderReport','loaLeaderBlocked','loaLeaderHandover','loaVolMyTasks']
    .forEach(fn=>assert(typeof sandbox[fn]==='function', fn+'() 存在'));
  assert(sandbox.LOA_CHAT && Array.isArray(sandbox.LOA_CHAT.leader), 'LOA_CHAT.leader 已註冊');

  sandbox.LOA_ROLE='leader';
  // 高風險任務 → 班長不可自行承接
  seedRTDB({
    tasks:{'T-HI':{title:'搶救受困',priority:'P1',status:'待派工',assignee:'',riskProfile:'high'}},
    volunteers:{}, auditLog:{}, sos:{active:false},
  });
  sandbox.loaLeaderAccept();
  var t=rtGet('tasks/T-HI');
  assert(t.status==='待派工', '高風險任務未被班長承接（守門生效）');
  assert(SPY.rtAudit.calls.some(c=>String(c[0]).includes('接單攔截')), '稽核記錄接單攔截');
  var staffMsgs=sandbox.LOA_CHAT.staff||[];
  assert(staffMsgs.some(m=>String(m.text||'').includes('覆核')), '幹部手機收到覆核通知');

  // 一般任務 → 接單成功 → 受阻上報
  resetSpies();
  seedRTDB({
    tasks:{'T-NM':{title:'物資搬運',priority:'P2',status:'待派工',assignee:'',riskProfile:'normal'}},
    volunteers:{}, auditLog:{}, sos:{active:false},
  });
  sandbox.loaLeaderAccept();
  t=rtGet('tasks/T-NM');
  assert(t.status==='進行中' && t.lockedBy==='SQ-01', '一般任務接單成功，鎖定班組');
  sandbox.loaLeaderBlocked();
  t=rtGet('tasks/T-NM');
  assert(t.status==='受阻', '受阻回報更新任務狀態');

  // 交接快照
  resetSpies();
  DATA.tasks.items=[{id:'X1',status:'done'},{id:'X2',status:'active'}];
  DATA.persons.cases=[{caseId:'C1',phase:'急救期',timeline:[]},{caseId:'C2',phase:'結案',timeline:[]}];
  sandbox.loaLeaderHandover();
  var h=rtGet('handover');
  assert(h && h.tasksDone===1 && h.tasksActive===1, '交接快照統計任務數正確');
  assert(h.casesActive===1 && h.casesClosed===1, '交接快照統計個案數正確');
  sandbox.LOA_ROLE='vol';
}

section('[T14] loaStaffTaskDone — LOA 端完工統一走 completeTask 回寫個案 timeline');
{
  resetSpies();
  sandbox.LOA_ROLE='staff';
  DATA.persons.cases=[{caseId:'SOS-7001',name:'測試己',phase:'急救期',sosId:'SOS-7001',timeline:[]}];
  DATA.tasks.items=[{id:'OPS-SOS-7001',title:'LOA完工測試',status:'active',pct:0,sosId:'SOS-7001'}];
  sandbox.loaStaffTaskDone('OPS-SOS-7001');
  assert(DATA.tasks.items[0].status==='done', 'LOA 完工任務標記 done');
  assert(DATA.persons.cases[0].timeline.some(e=>e.type==='任務完成'), 'LOA 完工回寫個案 timeline（原本漏寫）');
  resetSpies();
  sandbox.loaStaffTaskDone('NOT-EXIST');
  assert(DATA.tasks.items[0].status==='done', '不存在的任務 ID 不影響既有資料');
  sandbox.LOA_ROLE='vol';
}

// ══════════════════════════════════════════════════════════════════════════════
// RESULTS
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n' + '─'.repeat(60));
if (FAILURES === 0) {
  console.log(G + 'All tests passed ✓' + RST + '\n');
  process.exit(0);
} else {
  console.log(R + FAILURES + ' test(s) FAILED — see ✗ lines above' + RST + '\n');
  process.exit(1);
}
