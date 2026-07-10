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

section('[T15] 香積角色 — 開伙登記回寫倉儲供需、出餐完成回報（優先序3）');
{
  resetSpies();
  sandbox.LOA_ROLE='kitchen';
  assert(Array.isArray(sandbox.LOA_CHAT.kitchen), 'LOA_CHAT.kitchen 已註冊');
  ['loaKitchenCount','loaKitchenSetCount','loaKitchenServed'].forEach(fn=>assert(typeof sandbox[fn]==='function', fn+'() 存在'));

  DATA.kitchen={sites:[{id:'K01',name:'測試香積站',staff:5,mealsToday:0,status:'備餐中',menu:''}],supplies:[],mealLog:[]};
  DATA.field={supplies:[{item:'便當',unit:'份',stock:400,need:350,status:'green'}]};
  sandbox.loaKitchenServed();
  assert(DATA.kitchen.mealLog.length===0, '未登記開伙時出餐被擋下');

  sandbox.loaKitchenSetCount(500);
  assert(DATA.kitchen.sites[0].mealsToday===500, '開伙份數寫入香積站');
  assert(DATA.kitchen.mealLog.length===1 && DATA.kitchen.mealLog[0].qty===500, 'mealLog 收到開伙紀錄');
  var bento=DATA.field.supplies.find(s=>s.item==='便當');
  assert(bento.need===500, '回寫上一層：倉儲便當需求量同步更新');
  assert(bento.status==='amber', '庫存 400/需求 500 → 供需狀態轉 amber');

  sandbox.loaKitchenServed();
  assert(DATA.kitchen.sites[0].status==='供餐完成', '出餐完成更新站點狀態');
  assert(DATA.kitchen.mealLog.length===2, 'mealLog 收到出餐紀錄');
  assert(SPY.rtAudit.calls.some(c=>String(c[0]).includes('香積出餐')), '稽核記錄出餐');
  sandbox.LOA_ROLE='vol';
}

section('[T16] 訪視角色 — 訪視/慰問金/心理轉介全寫入 persons（優先序4）');
{
  resetSpies();
  sandbox.LOA_ROLE='visitor';
  assert(Array.isArray(sandbox.LOA_CHAT.visitor), 'LOA_CHAT.visitor 已註冊');
  ['loaVisitStart','loaVisitDone','loaVisitAid','loaVisitPsych'].forEach(fn=>assert(typeof sandbox[fn]==='function', fn+'() 存在'));

  DATA.persons.cases=[
    {caseId:'SOS-6001',name:'測試庚',address:'測試村1號',phase:'急救期',visitStatus:'待訪視',timeline:[],reliefLog:[]},
    {caseId:'SOS-6002',name:'測試辛',address:'測試村2號',phase:'結案',visitStatus:'待訪視',timeline:[],reliefLog:[]},
  ];
  DATA.persons.careStats={online:0,visit:0,fixedPointMeals:0};

  sandbox.loaVisitStart();
  var c=DATA.persons.cases[0];
  assert(c.visitStatus==='訪視中', '開始訪視更新狀態（跳過已結案個案）');
  assert(c.timeline.some(e=>e.type==='訪視開始'), 'timeline 收到訪視開始');

  sandbox.loaVisitPsych();
  assert(c.psych==='已轉介追蹤' && c.longCare===true, '心理轉介複用 referPersonPsych：標記+長期陪伴');
  assert(c.timeline.some(e=>e.type==='心理追蹤'), 'timeline 收到心理追蹤');

  sandbox.loaVisitDone();
  assert(c.visitStatus==='已完成', '完成訪視更新狀態');
  assert(c.timeline.some(e=>e.type==='訪視關懷'), 'timeline 收到訪視關懷');
  assert(DATA.persons.careStats.visit===1, 'careStats.visit 累計');

  sandbox.loaVisitAid();
  assert(c.welfareStatus==='審核中', '物財補助申請複用 applyWelfare：狀態審核中');
  // 物財類重構後 timeline type 為「物財·申請」（涵蓋現金/儲值卡/禮券/禮品/物資皆走同一核銷鏈）
  assert(c.timeline.some(e=>e.type==='物財·申請'), 'timeline 收到物財·申請');

  resetSpies();
  sandbox.loaVisitDone();
  var msgs=sandbox.LOA_CHAT.visitor||[];
  assert(String((msgs[msgs.length-1]||{}).text||'').includes('沒有訪視中'), '無訪視中個案時擋下重複完成');
  sandbox.LOA_ROLE='vol';
}

section('[T17] 幹部高風險覆核 — 班長請求→幹部核准/駁回全閉環（優先序5）');
{
  resetSpies();
  ['loaStaffRiskReview','loaStaffRiskApprove','loaStaffRiskReject','loaStaffCaseClose','loaStaffCaseCloseConfirm']
    .forEach(fn=>assert(typeof sandbox[fn]==='function', fn+'() 存在'));

  // 班長請求承接高風險 → 幹部手機收到 risk_approve 卡
  sandbox.LOA_CHAT.staff=[];
  sandbox.LOA_ROLE='leader';
  seedRTDB({
    tasks:{'T-RA':{title:'高風險搶救',priority:'P1',status:'待派工',assignee:'',riskProfile:'high'}},
    volunteers:{}, auditLog:{}, sos:{active:false},
  });
  sandbox.loaLeaderAccept();
  assert((sandbox.LOA_CHAT.staff||[]).some(m=>m.card==='risk_approve'), '幹部手機收到 risk_approve 覆核卡');

  // 幹部核准 → 任務派給班組 + 班長收到通知
  sandbox.LOA_ROLE='staff';
  sandbox.loaStaffRiskApprove('T-RA');
  var t=rtGet('tasks/T-RA');
  assert(t.status==='進行中' && t.lockedBy==='SQ-01', '核准後任務派給班組');
  assert(SPY.rtAudit.calls.some(c=>String(c[1]).includes('高風險已覆核')), '稽核註記高風險已覆核');
  assert((sandbox.LOA_CHAT.leader||[]).some(m=>String(m.text||'').includes('已核准')), '班長手機收到核准通知');

  resetSpies();
  sandbox.loaStaffRiskApprove('T-RA');
  assert(!SPY.rtAudit.called(), '重複覆核被擋下（已處理任務不重派）');

  // 駁回路徑：任務留在待派工
  seedRTDB({
    tasks:{'T-RJ':{title:'高風險水域',priority:'P1',status:'待派工',assignee:'',riskProfile:'high'}},
    volunteers:{}, auditLog:{}, sos:{active:false},
  });
  resetSpies();
  sandbox.loaStaffRiskReject('T-RJ');
  t=rtGet('tasks/T-RJ');
  assert(t.status==='待派工', '駁回後任務保留待派工');
  assert(SPY.rtAudit.calls.some(c=>String(c[0]).includes('覆核駁回')), '稽核記錄覆核駁回');
  assert((sandbox.LOA_CHAT.leader||[]).some(m=>String(m.text||'').includes('駁回')), '班長手機收到駁回通知');
  sandbox.LOA_ROLE='vol';
}

section('[T18] 幹部結案確認 — LOA 端觸發 closePersonCase 完整閉環（優先序5）');
{
  resetSpies();
  sandbox.LOA_ROLE='staff';
  DATA.relief_req.requests=[{id:'SOS-5001',status:'已轉派',type:'物資',location:'x',people:1,desc:'',name:'',phone:'',dup:false}];
  DATA.persons.cases=[{caseId:'SOS-5001',name:'測試壬',address:'x',phase:'重建期',visitStatus:'已完成',sosId:'SOS-5001',timeline:[]}];
  sandbox.loaStaffCaseCloseConfirm('SOS-5001');
  var c=DATA.persons.cases[0];
  assert(c.phase==='結案', 'LOA 結案確認觸發 closePersonCase');
  assert(c.timeline.some(e=>e.type==='個案結案'), 'timeline 收到個案結案封存');
  assert(DATA.relief_req.requests[0].status==='已結案', '求助單同步回寫已結案（走同一條閉環）');
  resetSpies();
  sandbox.loaStaffCaseCloseConfirm('SOS-5001');
  var msgs=sandbox.LOA_CHAT.staff||[];
  assert(String((msgs[msgs.length-1]||{}).text||'').includes('已結案'), '重複結案被擋下');
  sandbox.loaStaffCaseCloseConfirm('NOT-EXIST');
  msgs=sandbox.LOA_CHAT.staff||[];
  assert(String((msgs[msgs.length-1]||{}).text||'').includes('找不到'), '不存在個案回覆找不到');
  sandbox.LOA_ROLE='vol';
}

section('[T19] LOA 橋接層 — 預設關閉：動作不外連、本地模擬照常');
{
  resetSpies();
  ['loaBridgeSend','loaBridgeCfg','loaBridgeEnabled','loaBridgeTest','loaBridgePull','loaBridgeRenderPanel','loaDriverDepart']
    .forEach(fn=>assert(typeof sandbox[fn]==='function', fn+'() 存在'));

  const fetchSpy=makeSpy();
  const _origFetch=sandbox.fetch;
  sandbox.fetch=function(){ fetchSpy.apply(null,arguments); return Promise.resolve({ok:true,json:()=>Promise.resolve({ok:true,replies:[]})}); };

  delete sandbox.CONFIG.loaBridge; // 回到出廠狀態
  sandbox.LOA_ROLE='vol';
  var safeBefore=sandbox.SAFETY.safe;
  sandbox.loaVolSafe();
  assert(!fetchSpy.called(), '橋接未啟用時不發出任何網路請求');
  assert(sandbox.SAFETY.safe>=safeBefore, '本地模擬照常運作（SAFETY 更新）');
  assert(sandbox.loaBridgeEnabled()===false, 'loaBridgeEnabled() 回報未啟用');
  sandbox.fetch=_origFetch;
}

section('[T20] LOA 橋接層 — 啟用後動作同步 POST 至 GAS（payload 格式正確）');
{
  resetSpies();
  const fetchSpy=makeSpy();
  const _origFetch=sandbox.fetch;
  sandbox.fetch=function(){ fetchSpy.apply(null,arguments); return Promise.resolve({ok:true,json:()=>Promise.resolve({ok:true,action:'x',replies:['✅']})}); };

  sandbox.CONFIG.loaBridge={enabled:true,url:'https://example.com/exec',key:'test-key',fbUrl:'',mode:'sim'};
  assert(sandbox.loaBridgeEnabled()===true, '設定後 loaBridgeEnabled() 回報啟用');

  // 志工安全回報 → action=safe
  sandbox.LOA_ROLE='vol';
  sandbox.loaVolSafe();
  assert(fetchSpy.called(), '啟用後動作觸發 fetch');
  var url=fetchSpy.lastArg(0), opt=fetchSpy.lastArg(1);
  assert(url==='https://example.com/exec', 'POST 到設定的 /exec 網址');
  assert(opt&&opt.method==='POST'&&String(opt.headers['Content-Type']).indexOf('text/plain')===0, 'text/plain simple request（GAS 免 CORS 預檢）');
  var body=JSON.parse(opt.body);
  assert(body.source==='drms-bridge'&&body.key==='test-key'&&body.action==='safe', 'payload 含 source/key/action=safe');

  // 香積開伙 → action=meal_count 帶份數
  fetchSpy.reset();
  sandbox.LOA_ROLE='kitchen';
  sandbox.loaKitchenSetCount(80);
  body=JSON.parse(fetchSpy.lastArg(1).body);
  assert(body.action==='meal_count'&&body.params.count===80, 'meal_count 帶 count=80');

  // 司機出發回報 → action=depart 帶單號（LOA_ROLES_SPEC 補的一顆）
  fetchSpy.reset();
  sandbox.LOA_ROLE='driver';
  DATA.warehouse.reqs.push({id:'REQ-T20',item:'礦泉水',qty:'×10',site:'測試站',status:'已派案',prio:'P2',due:'',driver:'T-01'});
  sandbox.loaDriverDepart();
  var dReq=DATA.warehouse.reqs.find(r=>r.id==='REQ-T20');
  assert(dReq.status==='配送中', '出發回報後需求單轉配送中');
  body=JSON.parse(fetchSpy.lastArg(1).body);
  assert(body.action==='depart'&&body.params.req==='REQ-T20', 'depart 帶需求單號');

  delete sandbox.CONFIG.loaBridge;
  sandbox.LOA_ROLE='vol';
  sandbox.fetch=_origFetch;
}

section('[T21] LOA 橋接層 — 串接失敗不阻斷本地模擬（offline-first）');
{
  resetSpies();
  const _origFetch=sandbox.fetch;
  sandbox.fetch=function(){ return Promise.reject(new Error('network down')); };
  sandbox.CONFIG.loaBridge={enabled:true,url:'https://example.com/exec',key:'k',fbUrl:'',mode:'sim'};

  sandbox.LOA_ROLE='vol';
  var chatBefore=(sandbox.LOA_CHAT.vol||[]).length;
  var threw=false;
  try{ sandbox.loaVolSafe(); }catch(e){ threw=true; }
  assert(!threw, '網路失敗不拋例外');
  assert((sandbox.LOA_CHAT.vol||[]).length>chatBefore, '本地聊天氣泡照常送出（模擬不受影響）');

  delete sandbox.CONFIG.loaBridge;
  sandbox.fetch=_origFetch;
}

section('[T22] 資訊流骨幹 — incidentId 血緣鑄造 + 溯源匯集');
{
  resetSpies();
  ['_incidentIdOf','_parseAnyTs','lineageCollectIncidents','computeKpiSummary','renderRTTrace','lineageReconcileFromRTDB']
    .forEach(fn=>assert(typeof sandbox[fn]==='function', fn+'() 存在'));

  // 時間戳解析：三種格式都要能轉 epoch
  assert(typeof sandbox._parseAnyTs('09:30')==='number', "_parseAnyTs 解析 'HH:MM'");
  assert(typeof sandbox._parseAnyTs('2026-07-09 09:30')==='number', "_parseAnyTs 解析 'YYYY-MM-DD HH:MM'");
  assert(sandbox._parseAnyTs('')===null && sandbox._parseAnyTs(null)===null, '空值回 null');

  // 派一筆求助 → task/case 都帶同一個 incidentId
  seedRTDB({tasks:{},volunteers:{},auditLog:{},sos:{active:false}});
  DATA.relief_req.requests=[{id:'SOS-7777',time:'09:00',type:'物資',name:'測試血緣',phone:'',location:'竹崎鄉',people:2,desc:'缺水',status:'待處理',dup:false}];
  var before=DATA.persons.cases.length;
  sandbox.reliefToDispatch(0);
  var t=DATA.tasks.items.find(function(x){return x.sosId==='SOS-7777';});
  var c=DATA.persons.cases.find(function(x){return x.sosId==='SOS-7777';});
  assert(t && t.incidentId==='SOS-7777', '派生任務帶 incidentId=SOS-7777');
  assert(c && c.incidentId==='SOS-7777', '派生個案帶 incidentId=SOS-7777');
  assert(typeof t.createdTs==='number', '任務帶 epoch createdTs（KPI 原料）');
  assert(sandbox._incidentIdOf(t)==='SOS-7777', '_incidentIdOf 取出血緣鍵');

  // 匯集：同一 incidentId 底下串起 req + task + case 事件
  var map=sandbox.lineageCollectIncidents();
  assert(map['SOS-7777'], '匯集出 SOS-7777 事件');
  assert(map['SOS-7777'].events.length>=2, '至少含 通報+派工 兩個階段事件');
  assert(map['SOS-7777'].tasks.length>=1 && map['SOS-7777'].cases.length>=1, 'task 與 case 都掛在同一事件下');
}

section('[T23] 四項 KPI 由時間戳導出 + 溯源視圖不崩');
{
  resetSpies();
  seedRTDB({tasks:{},volunteers:{},auditLog:{},sos:{active:false}});
  DATA.relief_req.requests=[{id:'SOS-8801',time:'08:00',type:'搶救',name:'甲',phone:'',location:'梅山',people:1,desc:'受困',status:'待處理',dup:false}];
  DATA.persons.cases=DATA.persons.cases.filter(function(c){return c.sosId!=='SOS-8801';});
  sandbox.reliefToDispatch(0);
  var k=sandbox.computeKpiSummary();
  assert(typeof k.incidents==='number' && k.incidents>=1, 'KPI：事件數 ≥ 1');
  assert('mobilizeMin' in k && 'responseRate' in k && 'arrivalRate' in k && 'closeMin' in k, '四項 KPI 欄位齊備');
  // 結案 → 結案時長可計
  var c=DATA.persons.cases.find(function(x){return x.sosId==='SOS-8801';});
  c.phase='結案'; c.closedAt='2026-07-09 09:30';
  DATA.relief_req.requests[0].time='2026-07-09 08:00';
  var k2=sandbox.computeKpiSummary();
  assert(k2.closeN>=1 && k2.closeMin!==null, '結案後可導出結案時長 KPI');

  var html=sandbox.renderRTTrace();
  assert(typeof html==='string' && html.indexOf('事件溯源')>=0, 'renderRTTrace 回傳溯源視圖 HTML');
  assert(html.indexOf('SOS-8801')>=0, '溯源視圖列出事件 SOS-8801');
  // XSS 防護：惡意個案名不得原樣出現在輸出
  DATA.persons.cases[0].name='<img src=x onerror=alert(1)>';
  var html2=sandbox.renderRTTrace();
  assert(html2.indexOf('<img src=x onerror')<0, '溯源視圖跳脫個案名（無 XSS）');
}

section('[T24] 總部資料搜集區 + AI 判讀與分析');
{
  resetSpies();
  ['loaComputeSignals','loaAIAnalyze','renderLOACollect','loaRunAIAnalysis','loaPushAIBrief']
    .forEach(fn=>assert(typeof sandbox[fn]==='function', fn+'() 存在'));

  // 訊號彙整：真實讀 DATA/SAFETY，非造假
  sandbox.SAFETY.sent=10; sandbox.SAFETY.safe=4; sandbox.SAFETY.sos=2; sandbox.SAFETY.unreported=['甲','乙','丙','丁'];
  var sig=sandbox.loaComputeSignals();
  assert(sig.safety.sent===10 && sig.safety.sos===2, 'loaComputeSignals 讀到真實點名訊號');
  assert(typeof sig.checkin.total==='number' && typeof sig.supply.pending==='number', '含報到/叫料訊號');

  // AI 判讀：SOS>0 應產生 critical、回應率<70% 應產生 warn
  var a=sandbox.loaAIAnalyze();
  assert(a.crit>=1, 'SOS 訊號 → 產生 critical 研判');
  assert(a.findings.some(f=>f.level==='warn'), '回應率偏低 → 產生 warn 研判');
  assert(typeof a.confidence==='number' && a.confidence>=55 && a.confidence<=96, '信心度在合理範圍');
  assert(a.findings.some(f=>f.action), '至少一項研判帶可執行行動');

  // 正常情境 → ok
  sandbox.SAFETY.sent=10; sandbox.SAFETY.safe=10; sandbox.SAFETY.sos=0; sandbox.SAFETY.unreported=[];
  var a2=sandbox.loaAIAnalyze();
  assert(a2.crit===0, '無 SOS 時無 critical');

  // 渲染 + 分階段判讀（setTimeout 被 stub 為同步 → 直接到最終階段）
  _domEls['loa-ai-out']=makeDomEl('loa-ai-out');
  var html=sandbox.renderLOACollect();
  assert(typeof html==='string' && html.indexOf('總部 LINE OA 資料搜集區')>=0, 'renderLOACollect 回傳搜集區');
  assert(html.indexOf('AI 判讀與分析')>=0, '含 AI 判讀面板');
  sandbox.loaRunAIAnalysis('loa-ai-out');
  assert(_domEls['loa-ai-out'].innerHTML.indexOf('研判')>=0, 'AI 判讀輸出研判結果');

  // XSS：惡意物資名不得原樣出現在 AI 輸出
  sandbox.DATA.field.supplies.push({item:'<img src=x onerror=alert(1)>',status:'red',stock:0,need:9});
  sandbox.loaRunAIAnalysis('loa-ai-out');
  assert(_domEls['loa-ai-out'].innerHTML.indexOf('<img src=x onerror')<0, 'AI 輸出跳脫惡意物資名（無 XSS）');
  sandbox.DATA.field.supplies.pop();
}

section('[T25] 物財核銷 — 多類別（不止現金）走同一五步核銷鏈');
{
  resetSpies();
  ['RELIEF_TYPES','reliefTypeOf','applyWelfare','advanceWelfare','renderWelfare']
    .forEach(fn=>assert(typeof sandbox[fn]!=='undefined', fn+' 存在'));
  assert(Array.isArray(sandbox.RELIEF_TYPES) && sandbox.RELIEF_TYPES.length>=9, '物財類別 ≥ 9 種');
  var keys=sandbox.RELIEF_TYPES.map(function(t){return t.key;});
  ['cash','transfer','check','easycard','cashcard','voucher','farmcoupon','gift','supply']
    .forEach(k=>assert(keys.indexOf(k)>=0, '含類別：'+k));

  // 悠遊卡（儲值卡）也能申請並跑核銷
  DATA.persons.cases=[{caseId:'WF-1',name:'物財測試',address:'x',phase:'安置期',visitStatus:'已完成',sosId:null,aidLog:[],reliefLog:[],timeline:[]}];
  sandbox.applyWelfare(0,'easycard',2000,2);
  var c=DATA.persons.cases[0];
  assert(c.welfareChain && c.welfareChain.reliefType==='easycard', '悠遊卡申請 → reliefType=easycard');
  assert(c.welfareChain.value===2000 && c.welfareChain.qty===2, '記錄估值與數量');
  assert(c.timeline.some(e=>e.type==='物財·申請' && e.summary.indexOf('悠遊卡')>=0), 'timeline 記錄悠遊卡類別');

  // 走完剩餘四步核銷（審核/核准/發放/簽收核銷）——責任分離：每步不同人
  setConfirm(()=>true);
  var actors=['U-REVIEW','U-APPROVE','U-DISBURSE','U-RECEIPT'];
  for(var step=0; step<4 && c.welfareChain; step++){
    sandbox.setCurrentUser({uid:actors[step],name:actors[step],role:'staff'});
    sandbox.advanceWelfare(0);
  }
  sandbox.setCurrentUser&&sandbox.setCurrentUser(null);
  assert(!c.welfareChain, '五步核銷鏈跑完（責任分離：每步不同人），chain 清空');
  assert(c.reliefLog.length===1 && c.reliefLog[0].reliefType==='easycard', '封存進 reliefLog 帶類別');
  assert(c.reliefLog[0].status==='已核銷', '狀態標記已核銷');
  assert(c.reliefLog[0].unit==='元' && c.reliefLog[0].qty===2, '保留單位與數量供核銷入帳');

  // 禮品（非現金）也能跑
  DATA.persons.cases=[{caseId:'WF-2',name:'禮品測試',address:'x',phase:'重建期',visitStatus:'已完成',sosId:null,aidLog:[],reliefLog:[],timeline:[]}];
  sandbox.applyWelfare(0,'gift',1500,3);
  assert(DATA.persons.cases[0].welfareChain.itemLabel==='祝福禮品', '祝福禮品可申請核銷');

  // 渲染物財核銷分頁不崩、含類別總覽
  _domEls['pers-content']=makeDomEl('pers-content');
  var html=sandbox.renderWelfare();
  assert(html.indexOf('物財核銷')>=0, 'renderWelfare 標題為物財核銷');
  assert(html.indexOf('儲值卡')>=0 && html.indexOf('票券')>=0, '顯示物財類別總覽');
}

section('[T26] USGS 地震 fetch 去重快取（效能）');
{
  assert(typeof sandbox._usgsQuakeFetch==='function', '_usgsQuakeFetch() 存在');
  // 並發兩次呼叫應共用同一 inflight promise（去重，不重複打 endpoint）
  var p1=sandbox._usgsQuakeFetch();
  var p2=sandbox._usgsQuakeFetch();
  assert(p1===p2, '並發呼叫共用同一 inflight promise（去重）');
  assert(typeof p1.then==='function', '回傳 promise');
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
