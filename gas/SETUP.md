# GAS Webhook 部署步驟

> 2026-07-09 更新：後端已補齊 22 個 ACTION（班長/香積/訪視/司機/幹部全角色）、
> 驗證改 fail-closed、新增 DRMS 網頁橋接模式與 `?action=health` 健康檢查。

## 0. 部署前可先在本機驗證

```bash
node test_gas_handlers.js    # gas/ 後端 15 組測試（G1-G15：驗證策略/路由/成本紀律/Flex 卡/路徑注入/血緣）
node test_loa_integration.js # 前端 26 組測試（T1-T26：含橋接層 T19-T21、血緣/KPI T22-T23、AI 判讀 T24）
```

## 1. 建立 GAS 專案

1. 開 https://script.google.com
2. 點「新增專案」
3. 專案名稱改成 `TC-DRMS-Webhook`

## 2. 貼入程式碼

在左側「檔案」點 `+`，依序新增 5 個 `.gs` 檔案：

| 檔案名稱 | 來源 |
|---|---|
| `config.gs` | 複製 gas/config.gs 內容 |
| `webhook.gs` | 複製 gas/webhook.gs 內容 |
| `handlers.gs` | 複製 gas/handlers.gs 內容 |
| `push.gs` | 複製 gas/push.gs 內容 |
| `sheets.gs` | 複製 gas/sheets.gs 內容 |

## 3. 設定 Script Properties（密鑰）

GAS 編輯器 → 左上齒輪「專案設定」→「指令碼屬性」→「新增屬性」

| 屬性名稱 | 值 | 哪裡取得 / 用途 |
|---|---|---|
| `LINE_CHANNEL_SECRET` | xxxxxxxx | Line Developers → Basic settings（HMAC 驗簽） |
| `LINE_CHANNEL_TOKEN` | xxxxxxxx | Line Developers → Messaging API → Issue（推播） |
| `WEBHOOK_TOKEN` | 自訂一組亂數 | **必設**。GAS 讀不到 HTTP header、驗不了 X-Line-Signature，改在 Webhook URL 帶 `?token=` 核對（見步驟 5） |
| `BRIDGE_KEY` | 自訂一組亂數 | DRMS 網頁串接模式金鑰；不設＝橋接停用 |
| `ALLOW_UNSIGNED` | `true`（僅開發） | 沒設任何驗證手段時的開發後門；**正式環境不要設** |
| `FIREBASE_URL` | https://xxx.firebaseio.com | Firebase Console → RTDB |
| `FIREBASE_SECRET` | xxxxxxxx | Firebase Console → 專案設定 → 服務帳戶 |
| `SHEET_ID` | （試算表網址中間那串ID） | Google Sheets URL |

> Firebase 和 Sheets 是**可選的**。沒設就跳過，不影響 Line 基本回覆功能。
>
> ⚠ **fail-closed**：與舊版不同，什麼驗證都沒設時 webhook 一律回 403。
> 至少要設 `WEBHOOK_TOKEN`（正式）或 `ALLOW_UNSIGNED=true`（開發）其中之一。

## 4. 部署為網路應用程式

1. 右上角「部署」→「新增部署作業」
2. 類型選「**網路應用程式**」
3. 設定：
   - 說明：`DRMS Webhook v2`
   - 執行身分：**我**
   - 誰可以存取：**所有人**
4. 點「部署」
5. 複製 `/exec` 網址

部署後先打健康檢查確認設定：

```
GET <exec網址>?action=health
→ {"ok":true,"line":{"hasToken":true,...},"bridge":{"enabled":true},"actions":[22 個]}
```

## 5. 設定 Line Developers Console

1. 開 https://developers.line.biz
2. 選你的 Messaging API Channel
3. 「Messaging API」→「Webhook settings」
4. Webhook URL 填 **`/exec` 網址 + `?token=<WEBHOOK_TOKEN 的值>`**
   （LINE 呼叫時會原樣帶回 query string，GAS 以此驗證來源）
5. 點「Verify」→ 應該看到 `200 OK`
6. 開啟「Use webhook」

## 6. 填回 DRMS 系統管理

DRMS → 系統管理 → **Line OA 串接** 分頁 → 「🔗 GAS 串接模式」卡：

- 勾選「啟用串接模式」
- GAS Webhook /exec 網址：填步驟 4 的網址
- 橋接金鑰：填 `BRIDGE_KEY` 的值
- Firebase RTDB 網址（選填）：填了可按「⬇ 拉取 Firebase 現況」把 GAS 寫入的資料拉回中台
- 按「🩺 測試連線」確認 → 各 Line OA 頁面徽章從「🧪 模擬模式」變「🔗 串接模式」

啟用後，模擬器每顆按鈕（報到/叫料/安全/SOS/接單/點名/進度/受阻/交接/出發/開伙/出餐/訪視/慰問金/心理/覆核/結案/廣播/派工）都會同步 POST 至此後端；串接失敗只記 log、不影響本地模擬（offline-first）。

## 完成後的資料流

```
【正式流程】
志工 Line 操作（22 種 ACTION）
    ↓  HTTP POST
GAS doPost()  ← 驗證：簽名 or ?token=（fail-closed）
    ↓  routeAction 統一路由
handlers.gs
    ↓  寫入
Firebase RTDB  →  DRMS 中台即時更新（後台可一鍵拉回）
Google Sheets  →  備份紀錄
    ↓  推播
志工 Line  ← Flex Message 回覆（接單卡/覆核卡/點名卡/任務卡/配送單）

【串接模式（同一個後端）】
DRMS 網頁模擬器動作
    ↓  POST {source:'drms-bridge', key:BRIDGE_KEY, action, params}
GAS doPost() → 同一組 handlers → 同樣寫 Sheets/Firebase
    ↓  回覆文字進 replies[] 回傳網頁（推播紀錄可見）
```

## 測試

部署後直接從 Line 傳送：
- 傳「報到」→ 報到選單
- 傳「叫料」→ 品項選單
- 傳「安全」→ 確認訊息
- 傳「開伙 120」→ 香積開伙登記（快捷輸入）
- 傳「交接：現場已清運」→ 交接快照存檔
- 傳「受阻：道路中斷」→ 幹部端警示

訊息成本紀律（INFO_CHAIN_ADOPTION P1）：`broadcast` 動作預設**不打 LINE API**、
只留 RTDB/Sheets 紀錄；有指名 `params.to`（userId 陣列）才逐一 narrowcast push。
