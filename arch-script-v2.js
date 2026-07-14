(function(){
var root=document.getElementById('arch2-root');
// ── 場域（背景色塊，非框）──
var ZONES=[
  {cls:'chain1', lbl:'一、人力鏈 Person→Squad→Task', x:2,  y:2,  w:42, h:55},
  {cls:'chain2', lbl:'二、需求鏈 Case→Task→Squad',   x:2,  y:57, w:42, h:41},
  {cls:'chain3', lbl:'三、後勤鏈 Vehicle→Squad→Task', x:56, y:2,  w:42, h:55},
  {cls:'chain4', lbl:'四、交接鏈 Handover→全系統',    x:20, y:78, w:60, h:20},
  {cls:'chain5', lbl:'五、金援鏈 ReliefFund→審計',    x:56, y:57, w:42, h:41},
];

// ── 節點：Task 為中心，五體環繞 ──
var NODES=[
  // ── 中心 ──
  {id:'task',   nm:'Task 任務', ico:'📋', x:50, y:50, status:'live', kind:'core', center:true, locked:true,
   desc:'任務池、優先排序、派遣、執行、回報。五體交匯點。',
   script:'Task 是整個系統的最小執行單位。從 Case 分診產生、經 Squad 接單執行、Vehicle 後勤支援、Person 回報進度、ReliefFund 觸發發放——所有流程都以 Task 為錨點串聯。'},

  // ── 五體 ──
  {id:'person', nm:'Person 人', ico:'👤', x:33, y:38, status:'live', kind:'actor',
   desc:'志工 QR 報到→歸隊班組→接收任務→執行回報→效率累積。',
   script:'Person 是出班紀錄的最小粒度。報到時間戳+GPS+任務ID三合一構成不可竄改的出班證明（保險理賠依據）。AI 引擎從個人歷史數據學習效率，自動調整人力預估。'},

  {id:'squad',  nm:'Squad 班組', ico:'🪖', x:67, y:38, status:'planned', kind:'core',
   desc:'班長帶 5-10 人，統一接單/執行/回報。三層指揮鏈：總指揮→區隊長→班長→班員。',
   script:'Squad 是 Uber 接案模式的執行主體。班長從任務池一鍵接單，系統自動通知所有班員。HQ 作戰指揮圖即時顯示每班位置、狀態、負載。'},

  {id:'vehicle',nm:'Vehicle 車輛', ico:'🚛', x:67, y:62, status:'live', kind:'limb',
   desc:'梯次配車→司機GPS出發→班長收ETA→班員掃碼上車→物資自動扣庫存。',
   script:'Vehicle 是後勤鏈的物理載體。每台車的任務類型、GPS軌跡、物資裝載記錄構成碳足跡報告的原始數據。'},

  {id:'case',   nm:'Case 個案', ico:'🏠', x:33, y:62, status:'live', kind:'limb',
   desc:'LINE/電話/里長受理→地比比對→分診標籤(紅/黃/綠)→自動建Task→Before/After配對。',
   script:'Case 是需求鏈的起點。分診標籤驅動任務優先級：紅→P0立即、黃→P2一般、綠→電話追蹤。48h 後自動觸發追蹤任務，避免個案流失。'},

  {id:'relief', nm:'Relief Fund 金援', ico:'💰', x:50, y:72, status:'planned', kind:'core',
   desc:'個案核准→自動帶入資料→身份確認→雙人見證→受災戶簽名→存證照→不可刪帳本。',
   script:'Relief Fund 解決公信力問題。發放五步驟全程數位留存，同一個案再次申請需幹部額外授權（防止重複發放）。月底自動 CSV 供對帳。'},

  // ── AI 引擎 ──
  {id:'ai',     nm:'AI 智能引擎', ico:'🤖', x:50, y:8,  status:'planned', kind:'future',
   desc:'任務優先排序 / 人力建議 / 車輛調度 / 物資預測 / 熱力圖分析 / 效能分析 / 演習評估',
   script:'AI Engine 需要 3+ 次真實出班資料才有意義。7 個功能模組從最簡單的任務排序開始，逐步擴展到人力效率預測和物資消耗模型。Phase 4 實作。'},

  // ── 交接鏈核心 ──
  {id:'handover',nm:'Handover 交接', ico:'🤝', x:50, y:88, status:'planned', kind:'core',
   desc:'系統自動抓快照：未完任務/物資差異/待追個案/現場安全。班長確認→電子簽名→推播下梯→不可修改存檔。',
   script:'每梯次收班強制走完交接流程。系統自動比對出庫 vs 歸還 diff，班長只填補空白欄位，不從零打字。'},

  // ── 輸出層 ──
  {id:'hqdash', nm:'HQ Dashboard', ico:'📊', x:88, y:20, status:'live',  kind:'output',
   desc:'指揮官即時全局視圖：人力/任務/物資/金援 KPI'},
  {id:'squadapp',nm:'班長 APP',    ico:'📱', x:88, y:32, status:'planned',kind:'output',
   desc:'接單/回報/點名/SOS'},
  {id:'volapp', nm:'志工 APP',     ico:'📲', x:88, y:44, status:'partial', kind:'output',
   desc:'LINE OA：報到/回報/叫料'},
  {id:'finance',nm:'財務審計',     ico:'💼', x:88, y:56, status:'planned',kind:'output',
   desc:'金援帳本 / Gmail PDF / 月報 CSV'},
  {id:'insure', nm:'保險申報',     ico:'🛡️', x:88, y:68, status:'planned',kind:'output',
   desc:'自動生成事故記錄 PDF（時間戳+GPS+任務ID）'},
  {id:'govreport',nm:'政府報告',   ico:'🏛️', x:88, y:80, status:'planned',kind:'output',
   desc:'媒體/政府/捐款人年報，出班效益數據'},
];

// ── 連線 ──
var EDGES=[
  // 人力鏈
  {from:'person', to:'squad',   label:'歸隊',      talk:'報到後自動歸隊，班長即時見人數'},
  {from:'squad',  to:'task',    label:'接單',bi:true,talk:'班長一鍵接單/HQ指派，Uber模式'},
  {from:'person', to:'task',    label:'執行回報',   talk:'個人出班紀錄＋GPS＋任務ID'},
  {from:'ai',     to:'squad',   label:'人力建議',dash:true,talk:'AI推薦最適班組'},
  {from:'ai',     to:'person',  label:'效率學習',dash:true,talk:'個人效率歷史累積'},

  // 需求鏈
  {from:'case',   to:'task',    label:'分診建任務', talk:'紅→P0/P1，黃→P2，綠→電話'},
  {from:'task',   to:'case',    label:'完成更新',dash:true,talk:'Before/After配對+48h追蹤'},
  {from:'case',   to:'relief',  label:'核准發放',   talk:'自動帶入受災戶資料建RF單'},

  // 後勤鏈
  {from:'vehicle',to:'squad',   label:'車輛派遣',   talk:'司機打卡→班長收ETA→班員掃碼上車'},
  {from:'squad',  to:'vehicle', label:'物資裝載',   talk:'掃描裝載→倉儲自動扣庫存'},
  {from:'ai',     to:'vehicle', label:'調度建議',dash:true,talk:'AI車輛配對建議'},

  // 金援鏈
  {from:'relief', to:'finance', label:'帳務存檔',   talk:'不可刪帳本+Gmail PDF+CSV'},
  {from:'relief', to:'insure',  label:'保險記錄',dash:true,talk:'自動生成事故記錄PDF'},

  // 交接鏈
  {from:'task',   to:'handover',label:'收班快照',   talk:'未完任務+物資差異+待追個案'},
  {from:'handover',to:'squad',  label:'下梯交接',   talk:'電子簽名→推播下梯班長'},

  // AI引擎輸入
  {from:'task',   to:'ai',      label:'歷史資料',dash:true,talk:'每次出班數據餵給AI'},
  {from:'person', to:'ai',      label:'效率數據',dash:true,talk:'個人完成時間/任務類型'},

  // 輸出層
  {from:'task',   to:'hqdash',  label:'即時狀態',   talk:'任務進度→HQ指揮視圖'},
  {from:'squad',  to:'squadapp',label:'班長通知',   talk:'接單/SOS/點名'},
  {from:'task',   to:'volapp',  label:'志工通知',   talk:'派工/叫料回覆'},
  {from:'relief', to:'finance', label:'財務報表',dash:true,talk:'月底自動匯出'},
  {from:'task',   to:'govreport',label:'效益報告',dash:true,talk:'人次/車次/任務數'},
];

// ── 三視角：每視角的節點集 + 專屬故事腳本 ──
// VIEWS[view].nodes = 該視角顯示(其餘淡出)；stories = 旁白，每段 on=點亮節點，warn=紅標
var VIEWS={
  decider:{
    label:'決策者',
    nodes:['task','person','squad','vehicle','case','relief','ai','handover','hqdash'],
    stories:[
      {step:'全局',on:['task','person','squad','vehicle','case','relief'],
        text:'Task 是所有行動的錨點。Person 回報、Squad 執行、Vehicle 後勤、Case 需求、Relief 金援——五條鏈全以 Task 為中心串聯，指揮官一眼掌握現場。'},
      {step:'需求驅動',on:['case','task'],
        text:'個案分診後自動建任務。紅標→P0立即派遣，黃標→P2排隊，綠標→電話追蹤。需求直接驅動人力，不需人工中轉。'},
      {step:'班組接單',on:['squad','task'],
        text:'HQ 發布任務，班長從任務池一鍵接單，系統自動通知所有班員。Uber 模式讓人力分配有競爭、有效率、不靠記憶。'},
      {step:'後勤支援',on:['vehicle','squad','task'],
        text:'車輛配梯次出發，班長收到 ETA，班員掃碼上車，物資裝載自動扣庫存。後勤鏈全程數位留存。'},
      {step:'金援閉環',on:['case','relief','finance'],
        text:'個案核准→五步驟發放→不可刪帳本→Gmail 通知財務。每一筆都可追溯，公信力有資料支撐。'},
      {step:'交接不漏',on:['task','handover','squad'],
        text:'收班強制走交接流程。系統自動生成快照，班長確認後電子簽名，下梯班長接任前已知全部現場狀況。'},
      {step:'AI賦能',on:['ai','task','person','vehicle'],
        text:'AI Engine 從歷史出班資料學習：任務優先排序、人力效率預估、車輛調度建議。3+ 次真實出班後逐步啟用。'}
    ]
  },
  volunteer:{
    label:'志工',
    nodes:['person','squad','task','case','volapp','handover'],
    stories:[
      {step:'我報到',on:['person','squad'],
        text:'掃 QR 報到，系統自動歸隊到我的班組，班長即時看到本班人數。'},
      {step:'我接任務',on:['squad','task'],
        text:'班長從任務池接單，我的手機收到 LINE 推播，任務地點和類型一目了然。'},
      {step:'我回報',on:['person','task'],
        text:'執行中隨時回報進度，完工上傳照片，任務狀態即時更新到 HQ。'},
      {step:'我叫料',on:['task','volapp'],
        text:'現場缺料直接用 LINE OA 回報需求，系統媒合後通知我去哪領取。'},
      {step:'我交班',on:['task','handover'],
        text:'收班前系統生成交接快照，確認後簽名送出，下梯班長接手前已知現場全況。'}
    ]
  },
  tech:{
    label:'技術維運',
    nodes:['task','person','squad','vehicle','case','relief','ai','handover','hqdash','finance','insure','govreport'],
    stories:[
      {step:'資料模型',on:['task','person','squad','case'],
        text:'Task 是最小執行單位。Person/Squad 提供人力，Case 提供需求，Vehicle 提供後勤。所有實體以 Task ID 為外鍵串聯。'},
      {step:'輸出層',on:['hqdash','finance','insure','govreport'],
        text:'四個輸出模組從 Task/Relief 讀取資料：HQ Dashboard 即時 KPI、財務審計帳本、保險申報 PDF、政府效益年報。'},
      {step:'AI整合',on:['ai','task','person','vehicle'],
        text:'AI Engine 訂閱 Task/Person/Vehicle 的歷史事件流，輸出排序分數和調度建議。Phase 4 啟用，需真實資料基礎。'},
      {step:'交接機制',on:['handover','task','squad'],
        text:'Handover 快照從 Task（未完）+ Vehicle（差異）+ Case（待追）自動組合。存檔後設唯讀，防竄改。'},
      {step:'待修',on:['case','relief'],warn:['case','relief'],
        text:'⚠ 個資未加密（Case 含身份/聯絡資訊，P1）；Relief Fund 五步驟流程待實作；AI Engine 需 3+ 次真實資料才有意義。'}
    ]
  }
};
var curView='decider';
// 相容舊變數：storyShow 用 activeStories()
function activeStories(){return VIEWS[curView]?VIEWS[curView].stories:[];}

// ── 健檢資料：每節點健康狀態 done/todo/risk/merge + 問題詳情 ──
var HEALTH={
  task:     {s:'done',   issue:'核心運作正常。任務池/優先排序/派遣/回報四段完整。'},
  person:   {s:'done',   issue:'志工報到/歸隊/回報運作正常。出班證明三合一待強化（GPS精度）。'},
  squad:    {s:'todo',   issue:'Phase 0-A。DATA.squads schema 待建。班長APP介面待開發。'},
  vehicle:  {s:'done',   issue:'車輛派遣/掃碼上車運作正常。碳足跡計算待接。'},
  case:     {s:'done',   issue:'個案管理運作正常。個資未加密P1待修。'},
  relief:   {s:'todo',   issue:'Phase 3-A。五步驟流程/canvas簽名/不可刪帳本待開發。'},
  ai:       {s:'todo',   issue:'Phase 4。需3+次真實出班資料。7個子模組全待實作。'},
  handover: {s:'todo',   issue:'Phase 1-D。快照自動生成/電子簽名/不可修改機制待開發。'},
  hqdash:   {s:'done',   issue:'HQ儀表板運作正常。'},
  squadapp: {s:'todo',   issue:'班長APP介面待開發。目前透過LINE OA代替。'},
  volapp:   {s:'partial',issue:'LINE OA模擬器完整，真實Webhook 0%。'},
  finance:  {s:'todo',   issue:'Gmail PDF推送/月報CSV待開發。'},
  insure:   {s:'todo',   issue:'保險記錄PDF自動生成待開發。'},
  govreport:{s:'todo',   issue:'效益報告/媒體素材自動生成待開發。'},
};
var HEALTH_LBL={done:'完成',todo:'待補',risk:'風險',merge:'可整合'};
// 整合群組灰框（健檢視角顯示，標記建議不動結構）
var MERGE_FRAMES=[];
// 健檢走查旁白
VIEWS.health={
  label:'健檢',
  nodes:Object.keys(HEALTH),
  stories:[
    {step:'總覽',on:[],
      text:'健檢視角：綠=完成、黃=待補。點任一節點看該模組健檢結論。以下逐項走查。'},
    {step:'已上線',on:['task','person','vehicle','case','hqdash'],
      text:'🟢 已完成：Task 核心、Person 報到/回報、Vehicle 後勤、Case 個案、HQ Dashboard。五條鏈的核心路徑可跑通。'},
    {step:'待開發',on:['squad','relief','ai','handover','squadapp','finance','insure','govreport'],
      text:'🟡 待補：Squad 班組(Phase 0-A)、Relief Fund(Phase 3-A)、Handover 交接(Phase 1-D)、AI Engine(Phase 4)、四個輸出模組待實作。'},
    {step:'風險',on:['case','relief'],warn:['case','relief'],
      text:'⚠ 個資未加密（Case 含身份/聯絡資訊，P1 最高優先）；Relief Fund 金援發放流程待實作，現金發放公信力待補強。'}
  ]
};

var statusTag={live:'\uD83D\uDFE2 已開通',partial:'\uD83D\uDFE1 部分 / 待設定',planned:'\uD83D\uDD34 未開通 / 規劃中'};
var nodeById={};NODES.forEach(function(n){nodeById[n.id]=n;});
var DEFAULT_POS={};NODES.forEach(function(n){DEFAULT_POS[n.id]={x:n.x,y:n.y};});
var STORE_KEY='drms_arch_layout_v2';
document.getElementById('arch2-ver').textContent='v6.0 · Task 中心五鏈架構';
var stage=document.getElementById('arch2-stage');
var svg=document.getElementById('arch2-edges');
var detail=document.getElementById('arch2-detail');
var VW=1000,VH=688;

// E6: use localStorage for position persistence instead of sessionStorage
var POS_KEY='drms_arch2_pos';
function loadPos(){try{var raw=window.localStorage.getItem(POS_KEY)||window.sessionStorage.getItem(STORE_KEY);if(raw){var p=JSON.parse(raw);NODES.forEach(function(n){if(p[n.id]&&!n.locked){n.x=p[n.id].x;n.y=p[n.id].y;}});}}catch(e){}}
function savePos(){var p={};NODES.forEach(function(n){p[n.id]={x:n.x,y:n.y};});try{window.localStorage.setItem(POS_KEY,JSON.stringify(p));}catch(e){}}

function buildZones(){ZONES.forEach(function(z){var el=document.createElement('div');el.className='zone '+z.cls;el.style.left=z.x+'%';el.style.top=z.y+'%';el.style.width=z.w+'%';el.style.height=z.h+'%';el.innerHTML='<div class="zone-lbl">'+z.lbl+'</div>';stage.appendChild(el);});}
function buildNodes(){NODES.forEach(function(n){var el=document.createElement('div');el.className='node '+n.status+(n.center?' center':'')+(n.trigger?' trigger':'')+(n.mini?' mini':'');el.id='arch2-node-'+n.id;el.style.left=n.x+'%';el.style.top=n.y+'%';el.innerHTML='<div class="hbadge" id="arch2-hb-'+n.id+'"></div><div class="st '+n.status+'"></div><div class="ico">'+n.ico+'</div><div class="nm">'+n.nm+'</div><div class="kd">'+n.kind+'</div>';stage.appendChild(el);attachDrag(el,n);});}
function buildMergeFrames(){MERGE_FRAMES.forEach(function(mf,fi){var el=document.createElement('div');el.className='merge-frame';el.id='arch2-mf-'+fi;el.innerHTML='<div class="mf-lbl">'+mf.lbl+'</div>';stage.appendChild(el);});}
function positionMergeFrames(){MERGE_FRAMES.forEach(function(mf,fi){var el=document.getElementById('arch2-mf-'+fi);if(!el)return;var xs=[],ys=[];mf.nodes.forEach(function(id){var n=nodeById[id];if(n){xs.push(n.x);ys.push(n.y);}});if(!xs.length)return;var pad=7;var minx=Math.min.apply(null,xs)-pad,maxx=Math.max.apply(null,xs)+pad,miny=Math.min.apply(null,ys)-pad,maxy=Math.max.apply(null,ys)+pad;el.style.left=minx+'%';el.style.top=miny+'%';el.style.width=(maxx-minx)+'%';el.style.height=(maxy-miny)+'%';});}
function px(p){return p/100*VW;}function py(p){return p/100*VH;}
function buildEdges(){svg.setAttribute('viewBox','0 0 '+VW+' '+VH);var defs='<defs>'
  +'<marker id="arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#B8B8C0"/></marker>'
  +'<marker id="arrH" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#6B8CBE"/></marker>'
  +'<marker id="arrR" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto-start-reverse"><path d="M0,0 L7,3 L0,6 Z" fill="#B8B8C0"/></marker>'
  +'<marker id="arrRH" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto-start-reverse"><path d="M0,0 L7,3 L0,6 Z" fill="#6B8CBE"/></marker>'
  +'</defs>';svg.innerHTML=defs;EDGES.forEach(function(e,i){drawEdge(e,i);});}
function edgePath(a,b){
  var x1=px(a.x),y1=py(a.y),x2=px(b.x),y2=py(b.y);
  var dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy)||1;
  var ux=dx/len,uy=dy/len;        // 連線單位向量
  var nx=-uy,ny=ux;                // 法線單位向量
  // 法線側推：依長度比例(8%)，夾在 14~46px，短線少彎長線多彎
  var bow=Math.max(14,Math.min(46,len*0.08));
  // 控制點沿連線方向內縮 28%，讓曲線從端點「順出順入」而非從中點硬折
  var off=len*0.28;
  var c1x=x1+ux*off+nx*bow, c1y=y1+uy*off+ny*bow;
  var c2x=x2-ux*off+nx*bow, c2y=y2-uy*off+ny*bow;
  // label 取曲線參數中點(t=0.5)的三次貝茲座標
  var mx=0.125*x1+0.375*c1x+0.375*c2x+0.125*x2;
  var my=0.125*y1+0.375*c1y+0.375*c2y+0.125*y2;
  return {d:'M'+x1+','+y1+' C'+c1x+','+c1y+' '+c2x+','+c2y+' '+x2+','+y2, lx:mx, ly:my};
}
function drawEdge(e,i){var a=nodeById[e.from],b=nodeById[e.to];var pp=edgePath(a,b);var path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',pp.d);path.setAttribute('fill','none');path.setAttribute('stroke','#C4C4CC');path.setAttribute('stroke-width','2');path.setAttribute('marker-end','url(#arr)');if(e.dash)path.setAttribute('stroke-dasharray','5,5');if(e.bi)path.setAttribute('marker-start','url(#arrR)');path.setAttribute('id','arch-edge-'+i);path.onclick=(function(idx){return function(){selectEdge(idx);};})(i);svg.appendChild(path);var lab=document.createElement('div');lab.className='elabel';lab.id='arch2-elabel-'+i;lab.style.left=(pp.lx/VW*100)+'%';lab.style.top=(pp.ly/VH*100)+'%';lab.textContent=e.label;lab.onclick=(function(idx){return function(){selectEdge(idx);};})(i);stage.appendChild(lab);}
function refreshEdges(){EDGES.forEach(function(e,i){var a=nodeById[e.from],b=nodeById[e.to];var pp=edgePath(a,b);var path=document.getElementById('arch2-edge-'+i);if(path)path.setAttribute('d',pp.d);var lab=document.getElementById('arch2-elabel-'+i);if(lab){lab.style.left=(pp.lx/VW*100)+'%';lab.style.top=(pp.ly/VH*100)+'%';}});}

function attachDrag(el,n){var dragging=false,moved=false,sx,sy;
  function down(ev){if(n.locked)return;dragging=true;moved=false;el.classList.add('dragging');var pt=ev.touches?ev.touches[0]:ev;sx=pt.clientX;sy=pt.clientY;window.addEventListener('mousemove',move);window.addEventListener('mouseup',up);window.addEventListener('touchmove',move,{passive:false});window.addEventListener('touchend',up);ev.preventDefault();}
  function move(ev){if(!dragging)return;var pt=ev.touches?ev.touches[0]:ev;if(Math.abs(pt.clientX-sx)>3||Math.abs(pt.clientY-sy)>3)moved=true;var rect=stage.getBoundingClientRect();var nx=(pt.clientX-rect.left)/rect.width*100,ny=(pt.clientY-rect.top)/rect.height*100;nx=Math.max(2,Math.min(98,nx));ny=Math.max(2,Math.min(98,ny));n.x=nx;n.y=ny;el.style.left=nx+'%';el.style.top=ny+'%';refreshEdges();if(curView==='health')positionMergeFrames();ev.preventDefault();}
  function up(){if(!dragging)return;dragging=false;el.classList.remove('dragging');window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up);window.removeEventListener('touchmove',move);window.removeEventListener('touchend',up);if(moved){savePos();}else{selectNode(n.id);}}
  el.addEventListener('mousedown',down);
  el.addEventListener('touchstart',down,{passive:false});
  if(n.locked){el.style.cursor='pointer';el.addEventListener('click',function(){selectNode(n.id);});}
}

function clearSel(){var ss=root.querySelectorAll('.node.sel,.elabel.sel');for(var i=0;i<ss.length;i++)ss[i].classList.remove('sel');EDGES.forEach(function(e,i){var p=document.getElementById('arch2-edge-'+i);if(p){p.classList.remove('edge-active');p.setAttribute('stroke','#C4C4CC');p.setAttribute('marker-end','url(#arr)');if(e.bi)p.setAttribute('marker-start','url(#arrR)');}});}
function selectNode(id){
  // E7: in story mode, pause story, show node detail, add "繼續故事" button
  if(storyOn){
    storyOn=false;
    document.getElementById('arch2-storyBar').classList.remove('warn-bar');
    // Show node detail with "繼續故事" button appended
    clearSel();
    var el=document.getElementById('arch2-node-'+id);if(el)el.classList.add('sel');
    var n=nodeById[id];if(!n)return;
    var scr=n.script?'<div style="background:linear-gradient(135deg,var(--accent-bg),var(--blue-bg));border:1px solid var(--accent-border);border-radius:var(--r-sm);padding:11px 13px;margin-bottom:10px;font-size:12.5px;line-height:1.85;color:var(--text)"><span style="font-size:10px;font-weight:700;color:var(--accent);letter-spacing:.05em">💡 設計說明</span><br>'+n.script+'</div>':'';
    detail.innerHTML='<div class="detail-head"><div class="dico">'+n.ico+'</div><div class="dt"><h3>'+n.nm+'</h3><div class="meta">'+n.id+' · 故事模式暫停</div></div></div><div class="detail-body">'+scr+'<div style="font-size:11px;color:var(--text3);margin-bottom:12px">'+n.desc+'</div>'
      +'<button onclick="arch2_storyResume()" style="border:none;background:var(--accent);color:#fff;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">▶ 繼續故事</button>'
      +'</div>';
    return;
  }
  // Normal mode
  clearSel();var el=document.getElementById('arch2-node-'+id);if(el)el.classList.add('sel');var n=nodeById[id];EDGES.forEach(function(e,i){if(e.from===id||e.to===id){var p=document.getElementById('arch2-edge-'+i);if(p){p.classList.add('edge-active');p.setAttribute('marker-end','url(#arrH)');if(e.bi)p.setAttribute('marker-start','url(#arrRH)');}}});var subs=n.subs?'<div class="sub-mods">'+n.subs.map(function(s){return '<span class="sub-mod">'+s+'</span>';}).join('')+'</div>':'';var hext='';if(curView==='health'&&HEALTH[id]){var hs=HEALTH[id].s;var hcol={done:'green',todo:'amber',risk:'red',merge:'planned'}[hs];hext='<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)"><span class="tag '+hcol+'">🩺 '+HEALTH_LBL[hs]+'</span> <span style="font-size:11px">'+HEALTH[id].issue+'</span></div>';}var scr=n.script?'<div style="background:linear-gradient(135deg,var(--accent-bg),var(--blue-bg));border:1px solid var(--accent-border);border-radius:var(--r-sm);padding:11px 13px;margin-bottom:10px;font-size:12.5px;line-height:1.85;color:var(--text)"><span style="font-size:10px;font-weight:700;color:var(--accent);letter-spacing:.05em">💡 設計說明</span><br>'+n.script+'</div>':'';var pvBtn='<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap"><button onclick="arch2_pvShow(\''+n.id+'\',\''+n.nm.replace(/'/g,'')+'\')" style="border:none;background:var(--accent);color:#fff;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">🔍 看現況示意</button><button onclick="document.getElementById(\'arch2-fbPanel\').classList.add(\'on\');if(!document.getElementById(\'arch2-fbNode\').options.length)arch2_fbBuildNodeOptions_inner();document.getElementById(\'arch2-fbNode\').value=\''+n.nm.replace(/'/g,'')+'\'" style="border:1px solid var(--accent-border);background:var(--accent-bg);color:var(--accent);padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">📝 對此寫回饋</button></div>';detail.innerHTML='<div class="detail-head"><div class="dico">'+n.ico+'</div><div class="dt"><h3>'+n.nm+' <span class="tag '+n.status+'">'+statusTag[n.status]+'</span></h3><div class="meta">'+n.id+' · '+n.kind+'</div></div></div><div class="detail-body">'+scr+'<div style="font-size:11px;color:var(--text3)">'+n.desc+'</div>'+subs+hext+pvBtn+'</div>';}
// E7: resume story after node click pause
function storyResume(){ storyOn=true; document.getElementById('arch2-storyBar').classList.add('show'); storyShow(); }
window.arch2_storyResume=storyResume;
function selectEdge(i){if(storyOn)return;clearSel();var e=EDGES[i];var p=document.getElementById('arch2-edge-'+i);if(p){p.classList.add('edge-active');p.setAttribute('marker-end','url(#arrH)');if(e.bi)p.setAttribute('marker-start','url(#arrRH)');}var lab=document.getElementById('arch2-elabel-'+i);if(lab)lab.classList.add('sel');var a=nodeById[e.from],b=nodeById[e.to];var dir=e.bi?'\u2194 雙向':'\u2192 單向';var etalk=e.talk?'<div style="background:linear-gradient(135deg,var(--accent-bg),var(--blue-bg));border:1px solid var(--accent-border);border-radius:var(--r-sm);padding:11px 13px;margin-bottom:10px;font-size:12.5px;line-height:1.85;color:var(--text)"><span style="font-size:10px;font-weight:700;color:var(--accent);letter-spacing:.05em">💡 設計說明</span><br>'+e.talk+'</div>':'';detail.innerHTML='<div class="detail-head"><div class="dico">'+(e.bi?'\u2194':'\u2192')+'</div><div class="dt"><h3>'+a.nm+' '+(e.bi?'\u2194':'\u2192')+' '+b.nm+' <span class="tag '+(e.dash?'planned':'live')+'">'+(e.dash?'規劃/次要':'現行')+'</span></h3><div class="meta">'+dir+' · 「'+e.label+'」</div></div></div><div class="detail-body">'+etalk+'<div style="font-size:11px;color:var(--text3)">'+e.flow+'</div></div>';}

// ── 故事導覽 ──
var storyOn=false,storyIdx=0;
function storyStart(){storyOn=true;storyIdx=0;document.getElementById('arch2-storyBar').classList.add('show');storyShow();}
function storyEnd(){storyOn=false;document.getElementById('arch2-storyBar').classList.remove('show','warn-bar');clearDim();clearSel();applyView();detail.innerHTML='<div class="detail-empty">▲ 拖曳排版 · 點節點或線看說明 · 或按 ▶ 故事導覽</div>';}
function storyPrev(){if(storyIdx>0){storyIdx--;storyShow();}}
function storyNext(){var S=activeStories();if(storyIdx<S.length-1){storyIdx++;storyShow();}else{storyEnd();}}
function clearDim(){var ds=root.querySelectorAll('.dim,.hot,.warn,.edge-active');for(var i=0;i<ds.length;i++){ds[i].classList.remove('dim','hot','warn','edge-active');}}
function storyShow(){
  var S=activeStories();var s=S[storyIdx];if(!s)return;
  NODES.forEach(function(n){var el=document.getElementById('arch2-node-'+n.id);if(el)el.classList.remove('h-done','h-todo','h-risk','h-merge');});
  var bar=document.getElementById('arch2-storyBar');
  bar.classList.toggle('warn-bar',!!s.warn);
  document.getElementById('arch2-storyStep').textContent=(storyIdx+1)+' / '+S.length+' · '+s.step;
  document.getElementById('arch2-storyText').textContent=s.text;
  document.getElementById('arch2-sPrev').disabled=(storyIdx===0);
  document.getElementById('arch2-sNext').textContent=(storyIdx===S.length-1)?'✓':'›';
  var onNodes={};(s.on||[]).forEach(function(id){onNodes[id]=1;});
  var warnNodes={};(s.warn||[]).forEach(function(id){warnNodes[id]=1;});
  // 點亮 on 節點，其餘淡出；warn 紅標
  NODES.forEach(function(n){var el=document.getElementById('arch2-node-'+n.id);if(!el)return;el.classList.remove('hot','dim','warn');
    if(warnNodes[n.id])el.classList.add('warn');
    else if(onNodes[n.id])el.classList.add('hot');
    else el.classList.add('dim');});
  // 點亮兩端都在 on 集合內的線
  EDGES.forEach(function(e,i){var p=document.getElementById('arch2-edge-'+i);var lab=document.getElementById('arch2-elabel-'+i);
    var on=onNodes[e.from]&&onNodes[e.to];
    if(p){p.classList.toggle('hot',!!on);p.classList.toggle('dim',!on);p.classList.toggle('edge-active',!!on);p.setAttribute('marker-end',on?'url(#arrH)':'url(#arr)');if(e.bi)p.setAttribute('marker-start',on?'url(#arrRH)':'url(#arrR)');}
    if(lab)lab.classList.toggle('dim',!on);});
}

// ── 視角切換：過濾(淡出非視角節點) + 換腳本 ──
function setView(v){
  curView=v;storyEnd();
  var pills=root.querySelectorAll('.vpill');
  for(var i=0;i<pills.length;i++)pills[i].classList.toggle('act',pills[i].getAttribute('data-view')===v);
  applyView();
}
function clearHealth(){root.classList.remove('health-on');NODES.forEach(function(n){var el=document.getElementById('arch2-node-'+n.id);if(el)el.classList.remove('h-done','h-todo','h-risk','h-merge');});}
function applyView(){
  clearDim();clearSel();clearHealth();
  if(curView==='health'){
    root.classList.add('health-on');
    positionMergeFrames();
    NODES.forEach(function(n){var el=document.getElementById('arch2-node-'+n.id);if(!el)return;el.classList.remove('dim');var h=HEALTH[n.id];if(h){el.classList.add('h-'+h.s);var hb=document.getElementById('arch2-hb-'+n.id);if(hb)hb.textContent=HEALTH_LBL[h.s];}});
    EDGES.forEach(function(e,i){var p=document.getElementById('arch2-edge-'+i);var lab=document.getElementById('arch2-elabel-'+i);if(p)p.classList.remove('dim');if(lab)lab.classList.remove('dim');});
    return;
  }
  if(curView==='all'){
    NODES.forEach(function(n){var el=document.getElementById('arch2-node-'+n.id);if(el)el.classList.remove('dim');});
    EDGES.forEach(function(e,i){var p=document.getElementById('arch2-edge-'+i);var lab=document.getElementById('arch2-elabel-'+i);if(p)p.classList.remove('dim');if(lab)lab.classList.remove('dim');});
    return;
  }
  var set={};(VIEWS[curView].nodes||[]).forEach(function(id){set[id]=1;});
  NODES.forEach(function(n){var el=document.getElementById('arch2-node-'+n.id);if(el)el.classList.toggle('dim',!set[n.id]);});
  EDGES.forEach(function(e,i){var on=set[e.from]&&set[e.to];var p=document.getElementById('arch2-edge-'+i);var lab=document.getElementById('arch2-elabel-'+i);if(p)p.classList.toggle('dim',!on);if(lab)lab.classList.toggle('dim',!on);});
}

function resetLayout(){NODES.forEach(function(n){n.x=DEFAULT_POS[n.id].x;n.y=DEFAULT_POS[n.id].y;var el=document.getElementById('arch2-node-'+n.id);if(el){el.style.left=n.x+'%';el.style.top=n.y+'%';}});refreshEdges();savePos();}
function exportLayout(){var p={};NODES.forEach(function(n){p[n.id]={x:Math.round(n.x*10)/10,y:Math.round(n.y*10)/10};});window.prompt('複製座標 JSON：',JSON.stringify(p));}
function importLayout(){var s=window.prompt('貼上座標 JSON：','');if(!s)return;try{var p=JSON.parse(s);NODES.forEach(function(n){if(p[n.id]){n.x=p[n.id].x;n.y=p[n.id].y;var el=document.getElementById('arch2-node-'+n.id);if(el){el.style.left=n.x+'%';el.style.top=n.y+'%';}}});refreshEdges();savePos();}catch(e){window.alert('JSON 格式錯誤');}}

loadPos();buildZones();buildMergeFrames();buildEdges();buildNodes();applyView();
/* ───── 現況示意：每節點對應自己的內部畫面（仿 drms_v4，假數據、無 fetch） ───── */
/* Line OA 標竿格：雙線架構 + 5 操作頁籤 + 規則 */
function viewLineOA(){
  return ''+
  '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">'+
    /* 左：手機框 Line OA 模擬 */
    '<div style="width:280px;flex-shrink:0;border:1px solid var(--border2);border-radius:16px;overflow:hidden;background:var(--bg2);box-shadow:var(--shadow-md)">'+
      '<div style="display:flex;align-items:center;gap:9px;padding:11px 13px;border-bottom:1px solid var(--border)">'+
        '<div style="width:30px;height:30px;background:#06C755;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:16px">💬</div>'+
        '<div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--text)">Line OA 總控</div><div style="font-size:9px;color:var(--text4);font-family:monospace">慈濟 DRMS · 官方帳號</div></div></div>'+
      '<div style="display:flex;border-bottom:1px solid var(--border)">'+
        ['📤 推播','✅ 報到','🚨 點名','🎯 派工','📦 物資'].map(function(t,i){return '<div style="flex:1;padding:7px 2px;text-align:center;font-size:9.5px;font-weight:'+(i===0?'700':'500')+';color:'+(i===0?'#06C755':'var(--text4)')+';border-bottom:2px solid '+(i===0?'#06C755':'transparent')+'">'+t+'</div>';}).join('')+'</div>'+
      '<div style="padding:13px;min-height:140px">'+
        '<div style="font-size:10px;color:var(--text3);margin-bottom:8px;font-weight:700">📤 推播訊息（示意）</div>'+
        '<div style="background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:10px;font-size:11px;color:var(--text2);line-height:1.6">🚨 花蓮光復鄉淹水<br>需要志工 30 名<br><span style="color:#06C755;font-weight:700">→ 點我報到</span></div>'+
        '<div style="display:flex;gap:6px;margin-top:9px"><div style="flex:1;text-align:center;background:#06C755;color:#fff;font-size:10px;font-weight:700;padding:7px;border-radius:7px">推播全體</div><div style="flex:1;text-align:center;background:var(--bg3);color:var(--text3);font-size:10px;font-weight:600;padding:7px;border-radius:7px">分眾</div></div>'+
      '</div>'+
      '<div style="background:#0F172A;padding:7px 11px;font-size:9px;color:#475569;font-family:monospace">＞ push 已送出 · 受眾 128</div>'+
    '</div>'+
    /* 右：雙線架構 + 規則 */
    '<div style="flex:1;min-width:260px">'+
      '<div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:10px">🔀 雙 Line 架構</div>'+
      '<div style="display:flex;flex-direction:column;gap:10px">'+
        '<div style="border:1px solid var(--blue-border);background:var(--blue-bg);border-radius:10px;padding:12px">'+
          '<div style="font-size:12px;font-weight:700;color:var(--blue)">🌐 對外志工線</div>'+
          '<div style="font-size:10.5px;color:var(--text2);margin-top:5px;line-height:1.7">QR → <code style="font-family:monospace;background:var(--bg);padding:1px 5px;border-radius:4px">doGet ?email=xxx</code><br>社區志工掃碼 → 帶 email 查詢報名 → 報到</div></div>'+
        '<div style="border:1px solid var(--accent-border);background:var(--accent-bg);border-radius:10px;padding:12px">'+
          '<div style="font-size:12px;font-weight:700;color:var(--accent)">🏛 對內慈誠線</div>'+
          '<div style="font-size:10.5px;color:var(--text2);margin-top:5px;line-height:1.7">QR → <code style="font-family:monospace;background:var(--bg);padding:1px 5px;border-radius:4px">?type=inner</code> → LIFF 彈窗<br>→ <code style="font-family:monospace;background:var(--bg);padding:1px 5px;border-radius:4px">doPost</code> 驗證「編號＋姓名」→ 報到</div></div>'+
      '</div>'+
      '<div style="margin-top:12px;font-size:12px;font-weight:800;color:var(--text);margin-bottom:6px">📐 運作規則</div>'+
      '<ul style="margin:0;padding-left:18px;font-size:10.5px;color:var(--text2);line-height:1.85">'+
        '<li>兩條獨立 GAS：對外 doGet、對內 doPost，各自部署 /exec 網址</li>'+
        '<li>對內需編號＋姓名雙重驗證，對外僅 email 查詢</li>'+
        '<li>報到後自動加入 OA → 後續收推播任務（點名/派工/物資）</li>'+
        '<li>5 操作面板：推播 · 報到 · 點名 · 派工 · 物資</li>'+
      '</ul>'+
    '</div>'+
  '</div>';
}

var PV_VIEWS={ lineoa: {title:'Line OA',render:viewLineOA} };

function pvPlaceholder(name){
  return '<div style="text-align:center;padding:50px 20px;color:var(--text3)">'+
    '<div style="font-size:34px;margin-bottom:12px">🚧</div>'+
    '<div style="font-size:14px;font-weight:700;color:var(--text2)">「'+name+'」這格的內部示意製作中</div>'+
    '<div style="font-size:11px;margin-top:8px;line-height:1.7">目前已完成標竿格：<b>Line OA</b>（雙線架構）<br>確認版型後將逐格補完其餘模組畫面</div></div>';
}
function pvShow(id,name){
  var v=PV_VIEWS[id];
  document.getElementById('arch2-pvTitle').textContent='現況示意　·　'+(name||(v&&v.title)||id);
  document.getElementById('arch2-pvBody').innerHTML=v?v.render():pvPlaceholder(name||id);
  document.getElementById('arch2-pvMask').classList.add('on');
}
function pvHide(){document.getElementById('arch2-pvMask').classList.remove('on');}

/* ───── 回饋提交碼（相容 intake INTAKE1 格式） ───── */
function fbEncode(obj){return "INTAKE1:"+btoa(unescape(encodeURIComponent(JSON.stringify(obj))));}
var _fbCode="";
function arch2_fbBuildNodeOptions_inner(){
  var sel=document.getElementById('arch2-fbNode');if(!sel)return;
  var opts='<option value="（整體）">（整體／不限特定模組）</option>';
  if(typeof NODES!=='undefined'){NODES.forEach(function(n){opts+='<option value="'+n.nm+'">'+n.nm+'</option>';});}
  sel.innerHTML=opts;
}
function fbT(){
  var p=document.getElementById('arch2-fbPanel');p.classList.toggle('on');
  if(p.classList.contains('on')&&!document.getElementById('arch2-fbNode').options.length)arch2_fbBuildNodeOptions_inner();
}
function fbFlash(m,err){var e=document.getElementById('arch2-fbFlash');e.textContent=m;e.style.color=err?'var(--red)':'var(--green)';setTimeout(function(){e.textContent='';},3500);}
function fbGenCode(){
  var nick=document.getElementById('arch2-fbNick').value.trim();
  var text=document.getElementById('arch2-fbText').value.trim();
  if(!text){fbFlash('請先填寫回饋內容',true);return;}
  var obj={kind:'feedback',nick:nick||'匿名',node:document.getElementById('arch2-fbNode').value,
    ftype:document.getElementById('arch2-fbType').value,text:text,ts:Date.now()};
  _fbCode=fbEncode(obj);
  document.getElementById('arch2-fbCode').textContent=_fbCode;
  document.getElementById('arch2-fbOut').classList.add('on');
  fbFlash('提交碼已產生，請複製傳出 ✓');
}
function fbCopy(){navigator.clipboard.writeText(_fbCode).then(function(){fbFlash('已複製提交碼 ✓');}).catch(function(){fbFlash('複製失敗，請手動選取',true);});}
function fbDownload(){var b=new Blob([_fbCode],{type:'text/plain;charset=utf-8'});var u=URL.createObjectURL(b);var a=document.createElement('a');a.href=u;a.download='回饋提交碼.txt';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u);fbFlash('已下載 ✓');}

document.addEventListener('keydown',function(e){if(e.key==='Escape')pvHide();});
window.arch2_storyStart=storyStart;
window.arch2_storyEnd=storyEnd;
window.arch2_storyPrev=storyPrev;
window.arch2_storyNext=storyNext;
window.arch2_resetLayout=resetLayout;
window.arch2_exportLayout=exportLayout;
window.arch2_importLayout=importLayout;
window.arch2_setView=setView;
window.arch2_pvHide=pvHide;
window.arch2_pvShow=pvShow;
window.arch2_fbT=fbT;
window.arch2_fbGenCode=fbGenCode;
window.arch2_fbCopy=fbCopy;
window.arch2_fbDownload=fbDownload;

})();
