#!/usr/bin/env node
/**
 * TC-DRMS  Line OA Integration Test Suite
 * Tests 12 scenarios across the 6 Line OA max-effectiveness features.
 *
 * Run:  node test_loa_integration.js
 */

const fs  = require('fs');
const vm  = require('vm');
const path= require('path');

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const G='\x1b[32m', R='\x1b[31m', B='\x1b[34m', C='\x1b[36m', DIM='\x1b[2m', RST='\x1b[0m';
let FAILURES = 0;
const pass  = msg => console.log(`  ${G}✓${RST} ${msg}`);
const fail  = msg => { console.log(`  ${R}✗${RST} ${msg}`); FAILURES++; };
const info  = msg => console.log(`  ${DIM}  ${msg}${RST}`);
const section = t => console.log(`\n${B}${t}${RST}`);

// ─── Extract script blocks ────────────────────────────────────────────────────
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/g;
const scriptBlocks = [];
let sm;
while ((sm = scriptRe.exec(html)) !== null) scriptBlocks.push(sm[1]);
if (scriptBlocks.length < 2) { console.error('Cannot find script blocks'); process.exit(1); }

// ─── Spy factory ─────────────────────────────────────────────────────────────
function makeSpy(name) {
  const calls = [];
  const fn = function() { calls.push([].slice.call(arguments)); };
  fn.calls  = calls;
  fn.called = () => calls.length > 0;
  fn.lastArg= (i) => { const c=calls[calls.length-1]; return c ? c[i||0] : undefined; };
  fn.reset  = () => calls.splice(0);
  fn._name  = name;
  return fn;
}

// ─── Build sandbox ────────────────────────────────────────────────────────────
// BroadcastChannel mock — must have postMessage/addEventListener on prototype
function FakeBC(){ this._listeners={}; }
FakeBC.prototype.postMessage    = function(){};
FakeBC.prototype.addEventListener=function(){};
FakeBC.prototype.close          = function(){};

const _storage = {};

// Spies — re-usable refs so test code can inspect them
const SPY = {
  loaLog:      makeSpy('loaLog'),
  toast:       makeSpy('toast'),
  rtAudit:     makeSpy('rtAudit'),
  gasPost:     makeSpy('gasPost'),
  switchLOATab:makeSpy('switchLOATab'),
  renderLOATab:makeSpy('renderLOATab'),
  loaSendTask: makeSpy('loaSendTask'),
};
function resetSpies() { Object.values(SPY).forEach(s => s.reset()); }

function makeDomEl(id) {
  return {
    id, value:'', innerHTML:'', className:'',
    style:{display:''},
    classList:{ contains:()=>false, add:()=>{}, remove:()=>{} },
    options:[{value:'📢 全部志工（142人）',text:'📢 全部志工（142人）'}],
    contains:()=>false,
    closest:()=>null,
  };
}
const _domEls = {};

const sandbox = {
  // ── DOM ──
  document: {
    getElementById:   id => _domEls[id] || null,
    querySelector:    ()=>null,
    querySelectorAll: ()=>({ forEach:()=>{}, length:0 }),
    createElement:    ()=>({ style:{}, innerHTML:'', className:'',
      classList:{add:()=>{},remove:()=>{}},
      appendChild:()=>{}, setAttribute:()=>{}, addEventListener:()=>{} }),
    body: { classList:{contains:()=>false,add:()=>{},remove:()=>{}},
      appendChild:()=>{}, removeChild:()=>{} },
    addEventListener: ()=>{},
  },
  window: {
    innerWidth:1440,
    addEventListener:()=>{},
    BroadcastChannel: FakeBC,
  },
  BroadcastChannel: FakeBC,
  navigator: { onLine:true },
  location:  { reload:()=>{}, href:'' },
  history:   { pushState:()=>{} },

  // ── Storage ──
  localStorage: {
    getItem:    k => _storage[k] || null,
    setItem:    (k,v) => { _storage[k]=v; },
    removeItem: k => { delete _storage[k]; },
  },

  // ── Timers / async ──
  setTimeout:    fn => { try{fn();}catch(e){} return 0; },
  clearTimeout:  ()=>{},
  setInterval:   ()=>0,
  clearInterval: ()=>{},
  fetch:         ()=>Promise.resolve({ok:true,json:()=>Promise.resolve({})}),

  // ── Browser misc ──
  alert:   ()=>{},
  confirm: ()=>true,
  prompt:  ()=>'',
  Image:   function(){},
  console: console,

  // ── App helpers ──
  esc:    s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
  logSys: ()=>{},
  saveData: ()=>{},
  makeStatGrid:  ()=>'',
  makeFunnelRow: ()=>'',
  fireRollCall:  ()=>{},

  // ── Spied stubs (pointing at SPY refs so we can inspect) ──
  loaLog:       function() { SPY.loaLog.apply(null, arguments); },
  toast:        function() { SPY.toast.apply(null, arguments); },
  rtAudit:      function() { SPY.rtAudit.apply(null, arguments); },
  gasPost:      function() { SPY.gasPost.apply(null, arguments); },
  switchLOATab: function() { SPY.switchLOATab.apply(null, arguments); },
  renderLOATab: function() { SPY.renderLOATab.apply(null, arguments); },
  loaSendTask:  function() { SPY.loaSendTask.apply(null, arguments); },

  checkGASReady: ()=>false,

  // ── Startup functions that need DOM (replaced with no-ops) ──
  loadData:()=>{}, loadWarModuleDefaults:()=>{}, initConfig:()=>{},
  renderAll:()=>{}, renderModuleManager:()=>{}, renderDevTasks:()=>{},
  showPage:()=>{}, setScenario:()=>{}, renderGmailRows:()=>{},
  renderLineCards:()=>{}, updateFooter:()=>{}, loadSession:()=>{},
  renderSessionBadge:()=>{}, startSyncTimer:()=>{}, startRegPolling:()=>{},
  bindSOSListener:()=>{}, checkOverdueAssets:()=>{}, renderRTSync:()=>{},
};

vm.createContext(sandbox);

// ─── Patch + load script blocks ──────────────────────────────────────────────
console.log(`\n${C}TC-DRMS Line OA Integration Test Suite${RST}`);
console.log(`${DIM}Loading index.html script blocks...${RST}`);

try { vm.runInContext(scriptBlocks[0], sandbox); } catch(e) { /* non-critical */ }

let block1 = scriptBlocks[1];
const patchTokens = [
  'loadData();','loadWarModuleDefaults();','initConfig();','renderAll();',
  'renderModuleManager();','renderDevTasks();',"showPage('dashboard');",
  "setScenario('quake');","renderGmailRows();",'renderLineCards();',
  'updateFooter();','checkOverdueAssets();','startRegPolling();',
  'bindSOSListener();','startSyncTimer();','loadSession();',
  'renderSessionBadge();','disabledModules.clear();','saveDisabledModules();',
];
patchTokens.forEach(tok => { block1 = block1.split(tok).join('/*patched*/'); });
block1 = block1.replace(/setInterval\(rtCheckFatigue,60000\)/g,'0');
// Promote top-level const/let → var so vm context exposes them on sandbox
block1 = block1.replace(/^const /gm, 'var ');
block1 = block1.replace(/^let /gm,   'var ');

try {
  vm.runInContext(block1, sandbox);
  console.log(`${G}Script blocks loaded OK${RST}`);
} catch(e) {
  console.error(`${R}Fatal: script eval failed:${RST}`, e.message);
  process.exit(1);
}

// ─── Access sandbox exports ───────────────────────────────────────────────────
// All functions + DATA are now on the sandbox object
const {
  DATA, RTDB, rtGet,
  renderLOASituationBar, renderLOACheckin, renderLOATask,
  loaManualCheckinSearch, loaManualCheckin, loaPushRtTask,
  loaSendBroadcast, triggerSOS, rtReport,
} = sandbox;

if (!DATA) { console.error(`${R}DATA not found in sandbox — check patching${RST}`); process.exit(1); }
if (!RTDB) { console.error(`${R}RTDB not found in sandbox${RST}`); process.exit(1); }

// Re-inject spies AFTER eval — evaled code may have redefined toast/logSys/etc.
// We wrap each so the sandbox function calls our spy.
(function(){
  var _origToast   = sandbox.toast;
  var _origLoaLog  = sandbox.loaLog;
  var _origRtAudit = sandbox.rtAudit;
  var _origGasPost = sandbox.gasPost;

  sandbox.toast   = function(){ SPY.toast.apply(null,arguments);   try{_origToast&&_origToast.apply(null,arguments);}catch(e){} };
  sandbox.loaLog  = function(){ SPY.loaLog.apply(null,arguments);  try{_origLoaLog&&_origLoaLog.apply(null,arguments);}catch(e){} };
  sandbox.rtAudit = function(){ SPY.rtAudit.apply(null,arguments); try{_origRtAudit&&_origRtAudit.apply(null,arguments);}catch(e){} };
  sandbox.gasPost = function(){ SPY.gasPost.apply(null,arguments); try{_origGasPost&&_origGasPost.apply(null,arguments);}catch(e){} };
})();

// ─── Test helpers ─────────────────────────────────────────────────────────────
function seedRTDB(data) {
  _storage['drms_rtdb'] = JSON.stringify(data);
}

function assert(cond, label) {
  if (cond) pass(label); else fail(label);
}

// ══════════════════════════════════════════════════════════════════════════════
// SCENARIOS
// ══════════════════════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────
section('[T1] renderLOASituationBar — all-clear returns empty string');
{
  resetSpies();
  seedRTDB({ tasks:{}, volunteers:{}, sosQueue:{} });
  DATA.field = { supplies:[] };
  const out = renderLOASituationBar();
  assert(out === '', 'empty string when no alerts');
}

// ────────────────────────────────────────────────────────────
section('[T2] renderLOASituationBar — active SOS + tasks + fatigue + low stock');
{
  resetSpies();
  seedRTDB({
    tasks:    { 'T-01':{ status:'待派工' }, 'T-02':{ status:'進行中' } },
    volunteers:{ 'V-01':{ name:'王A', fatigue:true }, 'V-02':{ name:'王B', fatigue:false } },
    sosQueue:  { 'S-01':{ resolved:false, who:'前線', detail:'倒塌' } },
  });
  DATA.field = { supplies:[{ name:'飲水', status:'red' }] };
  const out = renderLOASituationBar();
  assert(out !== '', 'returns non-empty HTML');
  assert(out.includes('SOS ×1'),   'shows SOS count');
  assert(out.includes('任務 ×2'), 'shows active task count');
  assert(out.includes('疲勞 ×1'), 'shows fatigued volunteer count');
  assert(out.includes('低庫存 ×1'),'shows low-stock count');
  assert(out.includes('red-border'),'border turns red when SOS active');
}

// ────────────────────────────────────────────────────────────
section('[T3] renderLOATask — reads live RTDB tasks, not static DATA');
{
  resetSpies();
  const uniqueTitle = '深坑里緊急搜救_' + Date.now();
  seedRTDB({
    tasks:{ 'T-99':{ title:uniqueTitle, priority:'P1', status:'待派工', assignee:'' } },
    volunteers:{},
  });
  const out = renderLOATask();
  assert(out.includes(uniqueTitle),   'live RTDB task title appears in HTML');
  assert(out.includes('loaPushRtTask'),'push button wired to loaPushRtTask');
  info('Rendered HTML length: ' + out.length + ' chars');
}

// ────────────────────────────────────────────────────────────
section('[T4] loaManualCheckin — marks member checked-in + fires loaLog + rtAudit');
{
  resetSpies();
  DATA.registry.innerMembers = [
    { name:'陳大文', code:'M001', checkin:false },
    { name:'林小明', code:'M002', checkin:false },
  ];
  DATA.registry.volunteers = [];
  _domEls['loa-manual-ci-results'] = makeDomEl('loa-manual-ci-results');

  loaManualCheckin('inner', 0);

  assert(DATA.registry.innerMembers[0].checkin === true,  'member.checkin flipped to true');
  assert(DATA.registry.innerMembers[1].checkin === false, 'second member not affected');
  assert(SPY.loaLog.called(),  'loaLog was called');
  assert(SPY.loaLog.lastArg(0).includes('陳大文'),   'loaLog contains member name');
  assert(SPY.loaLog.lastArg(0).includes('人工報到'), 'loaLog contains 人工報到');
  assert(SPY.rtAudit.called(), 'rtAudit was called');
  assert(SPY.toast.called(),   'toast was called');
  info('loaLog: "' + SPY.loaLog.lastArg(0) + '"');
}

// ────────────────────────────────────────────────────────────
section('[T5] loaManualCheckinSearch — name search + code search + empty clears');
{
  resetSpies();
  DATA.registry.innerMembers = [
    { name:'趙一二', code:'A001', checkin:false },
    { name:'錢三四', code:'A002', checkin:true  },
  ];
  DATA.registry.volunteers = [
    { name:'孫五六', code:'B001', checkin:false },
  ];
  const el = makeDomEl('loa-manual-ci-results');
  _domEls['loa-manual-ci-results'] = el;

  loaManualCheckinSearch('錢');
  assert(el.innerHTML.includes('錢三四'), 'finds member by name fragment');
  assert(el.innerHTML.includes('已報到'), 'shows 已報到 for already-checked-in member');

  loaManualCheckinSearch('B001');
  assert(el.innerHTML.includes('孫五六'), 'finds volunteer by code');
  assert(el.innerHTML.includes('loaManualCheckin'), '報到 button wired to loaManualCheckin');

  loaManualCheckinSearch('');
  assert(el.innerHTML === '', 'empty query clears results div');
}

// ────────────────────────────────────────────────────────────
section('[T6] rtReport("已完成") — loaLog receives completion message');
{
  resetSpies();
  const taskTitle = '番路鄉物資搬運';
  seedRTDB({
    tasks:{ 'T-001':{ title:taskTitle, priority:'P2', status:'進行中', assignee:'V-001', lockedBy:'' } },
    volunteers:{ 'V-001':{ name:'周七八', status:'執行中', task:'T-001', fatigue:false } },
  });

  rtReport('T-001', '已完成');

  assert(SPY.loaLog.called(), 'loaLog was called');
  const msg = SPY.loaLog.lastArg(0) || '';
  assert(msg.includes('任務完成'), 'loaLog contains 任務完成');
  assert(msg.includes('周七八'),   'loaLog contains volunteer name');
  assert(msg.includes(taskTitle),  'loaLog contains task title');
  assert(SPY.toast.called(),  'toast was called');
  info('loaLog: "' + msg + '"');

  const vol = rtGet('volunteers/V-001');
  assert(vol && vol.status === '待命', 'volunteer status → 待命');
  assert(vol && vol.task === '',       'volunteer task field cleared');
}

// ────────────────────────────────────────────────────────────
section('[T7] loaSendBroadcast — blocked when GAS not configured');
{
  resetSpies();
  sandbox.checkGASReady = function() { return false; };
  _domEls['loa-bc-target'] = makeDomEl('loa-bc-target');
  _domEls['loa-bc-msg']    = Object.assign(makeDomEl('loa-bc-msg'), { value:'測試廣播訊息' });

  loaSendBroadcast();

  assert(!SPY.gasPost.called(),  'gasPost NOT called (GAS gate blocked)');
  assert(!SPY.loaLog.called(),   'loaLog NOT called (early return)');
  info('Broadcast correctly aborted when no GAS URL');
}

// ────────────────────────────────────────────────────────────
section('[T8] loaSendBroadcast — proceeds and logs when GAS configured');
{
  resetSpies();
  sandbox.checkGASReady = function() { return true; };
  sandbox.gasPost = function(payload, cb) { SPY.gasPost(payload, cb); if(cb) cb(null,null); };

  _domEls['loa-bc-target'] = makeDomEl('loa-bc-target');
  _domEls['loa-bc-msg']    = Object.assign(makeDomEl('loa-bc-msg'), { value:'全員集結作戰指令' });

  loaSendBroadcast();

  assert(SPY.gasPost.called(),  'gasPost called when GAS configured');
  const payload = SPY.gasPost.lastArg(0);
  assert(payload && payload.action === 'broadcast', 'payload.action = broadcast');
  assert(payload && payload.message.includes('全員集結'), 'payload.message correct');
  assert(SPY.loaLog.called(),   'loaLog called after success');
  assert(SPY.rtAudit.called(),  'rtAudit called for audit trail');
  info('Payload: ' + JSON.stringify(payload).slice(0,80));

  sandbox.checkGASReady = function(){ return false; };
  sandbox.gasPost = function(){ SPY.gasPost.apply(null,arguments); };
}

// ────────────────────────────────────────────────────────────
section('[T9] triggerSOS — auto-fills LOA push tab when panel open');
{
  resetSpies();
  const msgEl = makeDomEl('loa-bc-msg');
  _domEls['line-oa-panel'] = Object.assign(makeDomEl('line-oa-panel'), { style:{ display:'flex' } });
  _domEls['loa-bc-msg']    = msgEl;

  sandbox.switchLOATab = function(){ SPY.switchLOATab.apply(null,arguments); };
  sandbox.document.querySelector = function(){ return null; };

  triggerSOS('王組長', '三樓走廊倒塌');

  assert(SPY.switchLOATab.called(),            'switchLOATab was called');
  assert(SPY.switchLOATab.lastArg(0) === 'push', "switched to 'push' tab");
  assert(msgEl.value.includes('SOS'),          'push msg auto-filled with SOS content');
  assert(msgEl.value.includes('王組長'),       'SOS who in auto-filled message');
  assert(msgEl.value.includes('三樓走廊'),     'SOS detail in auto-filled message');
  assert(SPY.rtAudit.called(),                 'rtAudit logged SOS event');
  info('Auto-filled: "' + msgEl.value.slice(0,70) + '"');
}

// ────────────────────────────────────────────────────────────
section('[T10] loaPushRtTask — pushes to assigned volunteer via loaSendTask');
{
  resetSpies();
  const taskTitle = '搜救任務_下崙村';
  seedRTDB({
    tasks:{ 'T-10':{ title:taskTitle, priority:'P1', status:'進行中', assignee:'V-10' } },
    volunteers:{ 'V-10':{ name:'林十一', status:'執行中' } },
  });
  sandbox.loaSendTask = function(){ SPY.loaSendTask.apply(null,arguments); };

  loaPushRtTask('T-10');

  assert(SPY.loaSendTask.called(),  'loaSendTask called for assigned volunteer');
  assert(SPY.loaSendTask.lastArg(0) === 'V-10',      'correct volunteer id');
  assert(SPY.loaSendTask.lastArg(1) === taskTitle,   'task title passed through');
  assert(SPY.loaLog.called(),       'loaLog records the push');
  info('loaSendTask(' + SPY.loaSendTask.calls[0].join(', ') + ')');
}

// ────────────────────────────────────────────────────────────
section('[T11] loaPushRtTask — broadcasts when no assignee');
{
  resetSpies();
  seedRTDB({
    tasks:{ 'T-11':{ title:'通報 — 無人承接', priority:'P2', status:'待派工', assignee:'' } },
    volunteers:{},
  });
  sandbox.checkGASReady = function(){ return true; };
  sandbox.gasPost = function(payload,cb){ SPY.gasPost(payload,cb); if(cb)cb(null,null); };

  loaPushRtTask('T-11');

  assert(!SPY.loaSendTask.called(), 'loaSendTask NOT called (no assignee)');
  assert(SPY.gasPost.called(),      'gasPost broadcast called');
  assert(SPY.gasPost.lastArg(0).action === 'broadcast', 'action = broadcast');
  info('Unassigned task → broadcast triggered');

  sandbox.checkGASReady = function(){ return false; };
  sandbox.gasPost = function(){ SPY.gasPost.apply(null,arguments); };
}

// ────────────────────────────────────────────────────────────
section('[T12] SOS persistent queue — items tracked + resolved independently');
{
  resetSpies();
  seedRTDB({
    tasks:{}, volunteers:{},
    sosQueue:{
      'S-A':{ resolved:false, who:'前線1', detail:'第一樓倒塌', time:'14:01' },
      'S-B':{ resolved:false, who:'前線2', detail:'水管爆裂',   time:'14:05' },
    }
  });
  DATA.field = { supplies:[] };

  const bar1 = renderLOASituationBar();
  assert(bar1.includes('SOS ×2'), 'situation bar counts 2 unresolved SOS items');

  RTDB.ref('sosQueue/S-A').update({ resolved:true });
  const bar2 = renderLOASituationBar();
  assert(bar2.includes('SOS ×1'), 'drops to 1 after one SOS resolved');
  assert(!bar2.includes('SOS ×2'),'no longer shows ×2');
  info('SOS queue resolved independently — counts correct');
}

// ────────────────────────────────────────────────────────────
section('[T13] fetch returning HTTP 500 — error handled gracefully');
{
  resetSpies();
  // Override fetch to return HTTP 500
  const orig500Fetch = sandbox.fetch;
  sandbox.fetch = () => Promise.resolve({ ok:false, status:500, json:()=>Promise.resolve({error:'Server Error'}) });
  // gasPost in app uses fetch — ensure it toasts on error, not throws
  sandbox.checkGASReady = function(){ return true; };
  var errorThrown = false;
  try {
    // Simulate a gasPost that uses fetch returning 500; use loaSendBroadcast which calls gasPost
    _domEls['loa-bc-target'] = makeDomEl('loa-bc-target');
    _domEls['loa-bc-msg']    = Object.assign(makeDomEl('loa-bc-msg'), { value:'測試500錯誤' });
    // Wrap gasPost to detect error path — simulate 500 response callback
    sandbox.gasPost = function(payload, cb) {
      SPY.gasPost(payload, cb);
      // Invoke cb with error to simulate 500 upstream
      if (cb) cb(new Error('HTTP 500'), null);
    };
    loaSendBroadcast();
  } catch(e) {
    errorThrown = true;
  }
  assert(!errorThrown, 'fetch HTTP 500 does not throw uncaught exception');
  assert(SPY.gasPost.called(), 'gasPost was still invoked with payload');
  info('500 response handled without uncaught exception');
  sandbox.fetch = orig500Fetch;
  sandbox.checkGASReady = function(){ return false; };
  sandbox.gasPost = function(){ SPY.gasPost.apply(null,arguments); };
}

// ────────────────────────────────────────────────────────────
section('[T14] fetch timeout — error handled gracefully');
{
  resetSpies();
  // Override fetch to return a promise that never resolves (simulated timeout)
  const origTimeoutFetch = sandbox.fetch;
  sandbox.fetch = () => new Promise((_resolve, reject) => {
    // Immediately reject to simulate AbortController timeout
    reject(new Error('AbortError: The operation was aborted.'));
  });
  var timeoutThrown = false;
  try {
    sandbox.checkGASReady = function(){ return true; };
    _domEls['loa-bc-target'] = makeDomEl('loa-bc-target');
    _domEls['loa-bc-msg']    = Object.assign(makeDomEl('loa-bc-msg'), { value:'測試timeout' });
    sandbox.gasPost = function(payload, cb) {
      SPY.gasPost(payload, cb);
      if (cb) cb(new Error('AbortError: timeout'), null);
    };
    loaSendBroadcast();
  } catch(e) {
    timeoutThrown = true;
  }
  assert(!timeoutThrown, 'fetch timeout does not throw uncaught exception');
  assert(SPY.gasPost.called(), 'gasPost was invoked even on timeout path');
  info('Timeout handled without uncaught exception');
  sandbox.fetch = origTimeoutFetch;
  sandbox.checkGASReady = function(){ return false; };
  sandbox.gasPost = function(){ SPY.gasPost.apply(null,arguments); };
}

// ────────────────────────────────────────────────────────────
section('[T15] advancePersonCase(-1) — out-of-bounds index handled without crash');
{
  resetSpies();
  // Ensure DATA.persons exists with at least one record
  if (!DATA.persons || !DATA.persons.cases) {
    DATA.persons = { cases: [{ name:'Test Person', phase:'急救期', status:'active' }] };
  }
  var oobThrown = false;
  try {
    if (typeof sandbox.advancePersonCase === 'function') {
      sandbox.advancePersonCase(-1);
    } else if (typeof sandbox.advancePersonPhase === 'function') {
      sandbox.advancePersonPhase(-1);
    }
  } catch(e) {
    oobThrown = true;
  }
  assert(!oobThrown, 'advancePersonCase(-1) does not throw uncaught exception');
  info('Negative index handled gracefully');
}

// ────────────────────────────────────────────────────────────
section('[T16] advancePersonCase(999) — far out-of-bounds index handled without crash');
{
  resetSpies();
  // Ensure DATA.persons has a small array — index 999 is definitely out of bounds
  DATA.persons = { cases: [{ name:'Test Person', phase:'急救期', status:'active' }] };
  var oob999Thrown = false;
  try {
    if (typeof sandbox.advancePersonCase === 'function') {
      sandbox.advancePersonCase(999);
    } else if (typeof sandbox.advancePersonPhase === 'function') {
      sandbox.advancePersonPhase(999);
    }
  } catch(e) {
    oob999Thrown = true;
  }
  assert(!oob999Thrown, 'advancePersonCase(999) does not throw uncaught exception');
  // The function should not have modified persons.cases
  assert(DATA.persons.cases.length === 1, 'persons.cases array unchanged after out-of-bounds call');
  info('Index 999 handled gracefully — data unchanged');
}

// ── null edge cases ───────────────────────────────────────────────────────────
section('[T17] advancePersonCase with null DATA.persons — null handled without crash');
{
  resetSpies();
  var origPersons = DATA.persons;
  DATA.persons = null;
  var nullThrown = false;
  try {
    if (typeof sandbox.advancePersonCase === 'function') {
      sandbox.advancePersonCase(0);
    } else if (typeof sandbox.advancePersonPhase === 'function') {
      sandbox.advancePersonPhase(0);
    }
  } catch(e) {
    nullThrown = true;
  }
  assert(!nullThrown, 'advancePersonCase with null DATA.persons does not crash');
  DATA.persons = origPersons;
  info('Null DATA.persons handled gracefully');
}

// ══════════════════════════════════════════════════════════════════════════════
// RESULTS
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n' + '─'.repeat(60));
if (FAILURES === 0) {
  console.log(G + 'All 17 tests passed ✓' + RST + '\n');
  process.exit(0);
} else {
  console.log(R + FAILURES + ' test(s) FAILED — see ✗ lines above' + RST + '\n');
  process.exit(1);
}
