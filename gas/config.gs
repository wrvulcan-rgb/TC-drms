// ══════════════════════════════════════════════════════
//  config.gs — 所有設定從 Script Properties 讀取
//  設定方式：GAS 編輯器 → 專案設定 → 指令碼屬性 → 新增
// ══════════════════════════════════════════════════════

var PROP = PropertiesService.getScriptProperties();

var CFG = {
  // Line Messaging API
  CHANNEL_SECRET : PROP.getProperty('LINE_CHANNEL_SECRET'),  // 驗簽用
  CHANNEL_TOKEN  : PROP.getProperty('LINE_CHANNEL_TOKEN'),   // 推播用

  // Webhook URL token（GAS Web App 讀不到 HTTP header，無法驗 X-Line-Signature；
  // 補償控制：在 LINE Console 的 Webhook URL 加上 ?token=xxx，這裡核對 query token）
  WEBHOOK_TOKEN  : PROP.getProperty('WEBHOOK_TOKEN'),

  // 驗簽降級開關（僅開發環境用；未設任何驗證手段時預設拒收 = fail-closed）
  ALLOW_UNSIGNED : PROP.getProperty('ALLOW_UNSIGNED'),       // 設 'true' 才放行未驗證請求

  // DRMS 網頁橋接金鑰（模擬器 ⇄ 真實後端直連；未設 = 橋接停用）
  BRIDGE_KEY     : PROP.getProperty('BRIDGE_KEY'),

  // Firebase RTDB（可選，填了就即時同步到中台）
  FIREBASE_URL   : PROP.getProperty('FIREBASE_URL'),         // 例：https://xxx-default-rtdb.firebaseio.com
  FIREBASE_SECRET: PROP.getProperty('FIREBASE_SECRET'),      // Database Secret（或 Service Account token）

  // Google Sheets（備份用）
  SHEET_ID       : PROP.getProperty('SHEET_ID'),             // Spreadsheet ID

  // 內部志工編號驗證清單（Sheet 頁籤名）
  INNER_SHEET    : '慈誠委員',
  VOLUNTEER_SHEET: '社區志工',
  LOG_SHEET      : '事件紀錄',
};

// Line API 端點
var LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';
var LINE_PUSH_URL  = 'https://api.line.me/v2/bot/message/push';

// Postback action 常數（與前端 Line OA 模擬器對齊；LOA_ROLES_SPEC.md 串接點①〜⑧）
var ACTION = {
  // ── 志工/司機 核心 8 項 ──
  CHECKIN      : 'checkin',        // ① 掃碼報到
  SAFE         : 'safe',           // ⑥ 安全點名：安全
  SOS          : 'sos',            // ⑥ 安全點名：求救
  TASK_DONE    : 'task_done',      // ③ 任務完工確認
  SUPPLY_RECV  : 'supply_recv',    // ⑤ 物資到貨確認
  SUPPLY_START : 'supply_start',   // ④ 三步驟叫料：開始
  SUPPLY_ITEM  : 'supply_item',    // ④ 三步驟叫料：品項選擇
  SUPPLY_QTY   : 'supply_qty',     // ④ 三步驟叫料：數量
  // ── 班長 squad_*（LOA_ROLES_SPEC 優先序1）──
  SQUAD_ACCEPT : 'squad_accept',   // ② 接單（含婉拒，decision=accept|decline）
  SQUAD_ROLLCALL:'squad_rollcall', // ⑥ 班員點名（班級粒度）
  SQUAD_REPORT : 'squad_report',   // ③ 進度回報
  SQUAD_BLOCKED: 'squad_blocked',  // ③ 現場受阻 → 幹部端警示
  HANDOVER     : 'handover',       // ⑦ 交接快照
  // ── 司機補 1 顆（LOA_ROLES_SPEC §3）──
  DEPART       : 'depart',         // ③ 出發回報 → 幹部/班長端看得到在途
  // ── 香積 meal_*（優先序3）──
  MEAL_COUNT   : 'meal_count',     // ③ 今日開伙數登記 → 倉儲供需預估
  MEAL_DONE    : 'meal_done',      // ③ 出餐完成
  // ── 訪視 visit_*（優先序4）──
  VISIT_START  : 'visit_start',    // ③ 開始訪視
  VISIT_DONE   : 'visit_done',     // ③ 完成訪視＋關懷紀錄
  AID_REQUEST  : 'aid_request',    // ⑧ 慰問金申請（進五步驟審核鏈）
  PSYCH_REFER  : 'psych_refer',    // ⑧ 轉介心理
  // ── 幹部補 2 顆（優先序5）──
  RISK_APPROVE : 'risk_approve',   // ② 高風險派工覆核（decision=approve|reject）
  CASE_CLOSE   : 'case_close',     // ⑧ 結案確認
};

// 叫料品項清單（與 DATA.warehouse 對齊）
var SUPPLY_ITEMS = ['礦泉水','便當','白米','蔬菜','醫療耗材','毛毯','發電機燃油','清潔用品'];
