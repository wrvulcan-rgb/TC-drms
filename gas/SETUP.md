# GAS Webhook 部署步驟

## 1. 建立 GAS 專案

1. 開 https://script.google.com
2. 點「新增專案」
3. 專案名稱改成 `TC-DRMS-Webhook`

## 2. 貼入程式碼

在左側「檔案」點 `+`，依序新增 4 個 `.gs` 檔案：

| 檔案名稱 | 來源 |
|---|---|
| `config.gs` | 複製 gas/config.gs 內容 |
| `webhook.gs` | 複製 gas/webhook.gs 內容 |
| `handlers.gs` | 複製 gas/handlers.gs 內容 |
| `push.gs` | 複製 gas/push.gs 內容 |
| `sheets.gs` | 複製 gas/sheets.gs 內容 |

## 3. 設定 Script Properties（密鑰）

GAS 編輯器 → 左上齒輪「專案設定」→「指令碼屬性」→「新增屬性」

| 屬性名稱 | 值 | 哪裡取得 |
|---|---|---|
| `LINE_CHANNEL_SECRET` | xxxxxxxx | Line Developers → Basic settings |
| `LINE_CHANNEL_TOKEN` | xxxxxxxx | Line Developers → Messaging API → Issue |
| `FIREBASE_URL` | https://xxx.firebaseio.com | Firebase Console → RTDB |
| `FIREBASE_SECRET` | xxxxxxxx | Firebase Console → 專案設定 → 服務帳戶 |
| `SHEET_ID` | （試算表網址中間那串ID） | Google Sheets URL |

> Firebase 和 Sheets 是**可選的**。沒設就跳過，不影響 Line 基本回覆功能。

## 4. 部署為網路應用程式

1. 右上角「部署」→「新增部署作業」
2. 類型選「**網路應用程式**」
3. 設定：
   - 說明：`DRMS Webhook v1`
   - 執行身分：**我**
   - 誰可以存取：**所有人**
4. 點「部署」
5. 複製 `/exec` 網址

## 5. 設定 Line Developers Console

1. 開 https://developers.line.biz
2. 選你的 Messaging API Channel
3. 「Messaging API」→「Webhook settings」
4. Webhook URL 填入 `/exec` 網址
5. 點「Verify」→ 應該看到 `200 OK`
6. 開啟「Use webhook」

## 6. 填回 DRMS 系統管理

DRMS → 系統管理 → Line OA 設定：
- Channel Access Token：填 `LINE_CHANNEL_TOKEN` 的值
- Webhook 端點（doPost URL）：填 `/exec` 網址

## 完成後的資料流

```
志工 Line 操作
    ↓  HTTP POST
GAS doPost()  ← 你部署的這個
    ↓  驗簽 → 解析 → 分派
handlers.gs
    ↓  寫入
Firebase RTDB  →  DRMS 中台即時更新
Google Sheets  →  備份紀錄
    ↓  推播
志工 Line  ← Flex Message 回覆
```

## 測試

部署後在 GAS 編輯器執行 `testWebhook`（如果有的話）或直接從 Line 傳送：
- 傳「報到」→ 應該看到報到選單
- 傳「叫料」→ 應該看到品項選單
- 傳「安全」→ 應該看到確認訊息
