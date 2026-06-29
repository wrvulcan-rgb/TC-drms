# arch-script-v2.js 重建規格
> 對齊 2026-06-29 上傳圖片「慈濟災害應變平台：全系統資料串聯架構圖」
> 下次開場直接讀此檔執行，無需重新分析圖片

## 任務
完整替換 arch-script-v2.js 的 ZONES/NODES/EDGES/HEALTH/VIEWS
保留所有 arch2- ID 前綴與 window.arch2_* 全域函式結構不動

---

## 核心佈局：Task 為中心，五體環繞

```
         AI Engine (50,8)
              ↓
    Person(33,38) ←→ Squad(67,38)
          ↘    Task(50,50)    ↙
    Case(33,62)  ←→  Vehicle(67,62)
              ↓
         ReliefFund(50,72)
```

---

## ZONES（5個）

```js
var ZONES=[
  {cls:'chain1', lbl:'一、人力鏈 Person→Squad→Task', x:2,  y:2,  w:42, h:55},
  {cls:'chain2', lbl:'二、需求鏈 Case→Task→Squad',   x:2,  y:57, w:42, h:41},
  {cls:'chain3', lbl:'三、後勤鏈 Vehicle→Squad→Task', x:56, y:2,  w:42, h:55},
  {cls:'chain4', lbl:'四、交接鏈 Handover→全系統',    x:20, y:78, w:60, h:20},
  {cls:'chain5', lbl:'五、金援鏈 ReliefFund→審計',    x:56, y:57, w:42, h:41},
];
```

CSS 新增（貼 arch-style.css #arch2-root 區段末）：
```css
#arch2-root .zone.chain1{background:rgba(59,130,246,.07);border-color:rgba(59,130,246,.2)}
#arch2-root .zone.chain1 .zone-lbl{color:#3B82F6}
#arch2-root .zone.chain2{background:rgba(239,68,68,.07);border-color:rgba(239,68,68,.2)}
#arch2-root .zone.chain2 .zone-lbl{color:#EF4444}
#arch2-root .zone.chain3{background:rgba(34,197,94,.07);border-color:rgba(34,197,94,.2)}
#arch2-root .zone.chain3 .zone-lbl{color:#22C55E}
#arch2-root .zone.chain4{background:rgba(249,115,22,.07);border-color:rgba(249,115,22,.2)}
#arch2-root .zone.chain4 .zone-lbl{color:#F97316}
#arch2-root .zone.chain5{background:rgba(234,179,8,.07);border-color:rgba(234,179,8,.2)}
#arch2-root .zone.chain5 .zone-lbl{color:#EAB308}
```

---

## NODES（完整清單）

```js
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
```

---

## EDGES（關鍵連線，可依實作逐步補全）

```js
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
```

---

## VIEWS 更新

```js
// decider.nodes
['task','person','squad','vehicle','case','relief','ai','handover','hqdash']

// volunteer.nodes  
['person','squad','task','case','volapp','handover']

// tech.nodes
['task','person','squad','vehicle','case','relief','ai','handover','hqdash','finance','insure','govreport']

// health: 自動從 HEALTH object keys 產生
```

---

## HEALTH 新增條目

```js
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
```

---

## 執行指令（下次開場直接貼給Claude）

```
讀取 /home/user/TC-drms/ARCH_V2_SPEC.md，
完整替換 arch-script-v2.js 的 ZONES/NODES/EDGES/HEALTH/VIEWS，
對齊規格檔的資料，保留所有 arch2- 前綴與 window.arch2_* 結構，
完成後 syntax check → commit → push feature branch → merge main。
```
