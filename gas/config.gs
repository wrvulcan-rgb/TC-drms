// ══════════════════════════════════════════════════════
//  config.gs — 所有設定從 Script Properties 讀取
//  設定方式：GAS 編輯器 → 專案設定 → 指令碼屬性 → 新增
// ══════════════════════════════════════════════════════

var PROP = PropertiesService.getScriptProperties();

var CFG = {
  // Line Messaging API
  CHANNEL_SECRET : PROP.getProperty('LINE_CHANNEL_SECRET'),  // 驗簽用
  CHANNEL_TOKEN  : PROP.getProperty('LINE_CHANNEL_TOKEN'),   // 推播用

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

// Postback action 常數（與前端 Line OA 模擬器對齊）
var ACTION = {
  CHECKIN      : 'checkin',       // 掃碼報到
  SAFE         : 'safe',          // 安全點名：安全
  SOS          : 'sos',           // 安全點名：求救
  TASK_DONE    : 'task_done',     // 任務完工確認
  SUPPLY_RECV  : 'supply_recv',   // 物資到貨確認
  SUPPLY_START : 'supply_start',  // 三步驟叫料：開始
  SUPPLY_ITEM  : 'supply_item',   // 三步驟叫料：品項選擇
  SUPPLY_QTY   : 'supply_qty',    // 三步驟叫料：數量
};

// 叫料品項清單（與 DATA.warehouse 對齊）
var SUPPLY_ITEMS = ['礦泉水','便當','醫療耗材','毛毯','發電機燃油','清潔用品'];
