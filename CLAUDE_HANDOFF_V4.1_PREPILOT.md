# TC-DRMS v4.1.0 Pre-Pilot 現實落地優化計畫暨 Claude 交接文件

- **計畫文件版本：1.0.0**
- **目標系統版本：TC-DRMS v4.1.0-prepilot**
- **日期：2026-07-16**
- **Repository：`wrvulcan-rgb/TC-drms`**
- **文件狀態：可執行基準版；治理 Gate 未通過前不得連正式個資或正式災害作業**
- **建議 Repo 路徑：`CLAUDE_HANDOFF_V4.1_PREPILOT.md`**

---

## 0. 給 Claude 的接手指令

本文件是 TC-DRMS 下一版本的主要交接基準。接手時依序讀取：

1. `CLAUDE.md`
2. `CLAUDE_HANDOFF_V4.1_PREPILOT.md`
3. `GROWTH_ROADMAP.md`
4. `SYSTEM_AUDIT_2026-07-09.md`
5. `AUTH_MATRIX_SPEC.md`
6. `FABLE_HANDOFF.md`
7. `errors.md` 最近 10 筆
8. `test_gas_handlers.js`
9. `test_loa_integration.js`
10. 本次要修改的實際程式檔

執行規則：

- 一次只處理一個 PR 工作包。
- 不得因本文件提到未來可能性而重建 PostgreSQL、微服務、完整 Offline Outbox、完整 Identity Provider 或庫存 Ledger。
- 不得自動合併 `main`；每個工作包完成後停在 feature branch，提交測試結果與差異摘要，等待 Mason 明確核准。
- 不得使用真實身分證、醫療、心理、金援或正式災民資料做測試。
- 不得以畫面 Toast 當作外部寫入成功的證據。
- 所有新資料格式必須先支援舊格式讀取，再切換新 writer。
- 每個 PR 必須更新測試、`errors.md`，以及受影響的架構／Roadmap 文件。
- 若程式碼與本文件衝突，以實際 `main` 程式為準，先回報差異，不得自行擴大範圍。

---

# 1. 一句話目標

在不推翻現有原型的前提下，將 TC-DRMS 從「功能完整但外部串接尚未被真實驗證的展示系統」，提升為：

> **可用測試 LINE 帳號、GAS、Google Sheets 與 Firebase Test Project 完成一輪可追蹤、可去重、失敗不假成功、演練不污染、可回滾的受控 Pre-Pilot。**

本版本優先改善資訊流正確性與使用者信任，不以新增功能數量作為進度。

---

# 2. 已查證的現況基線

以下內容已由 Repository 程式或既有文件交叉確認。

## 2.1 已存在的能力

- 主前端為 `index.html + style.css + app.js`，核心功能仍集中在大型 `app.js`。
- 本機資料主要使用 `DATA`、localStorage 與模擬 RTDB adapter。
- LINE OA 前端模擬器與多角色操作已存在。
- `gas/` 已包含 Webhook、Bridge、22 個 Action、Sheets 寫入、Firebase REST 寫入與 LINE Flex／Push。
- `incidentId` 血緣、KPI、溯源視圖與 RTDB→DATA 對帳已有實作基礎。
- `AUTH_MATRIX_SPEC.md` 已規格化 `can()`、補償控制、破窗與 PII 分級方向；不應另造第二套授權架構。
- 既有測試：
  - `node test_gas_handlers.js`
  - `node test_loa_integration.js`
- 既有 Roadmap 將下一步定義為「部署既有後端並以真實測試資料驗證」，不是立即企業級重構。

## 2.2 尚未完成或無法由 Repo 證明的事項

- GAS、LINE Webhook、Firebase、Sheets 尚無可由 Repo 驗證的正式營運部署。
- 尚無可驗證的真實災害運行紀錄。
- Google Sheets 被既有文件定位為正式紀錄候選，但目前並未由程式完整強制為所有 Action 的唯一真相。
- Firebase 目前仍同時被模擬為即時層與資料來源；正式安全規則尚待部署驗證。
- Web、LINE、名冊與角色尚無統一穩定 Person ID。
- `main` 是否直接驅動 GitHub Pages 或其他 Production deployment，需另外查證。
- Apps Script `TextOutput` 內的 `{status:403}` 只是 JSON 內容，不是真正可控制的 HTTP 403 狀態。
- 現有 Node VM 測試不等於真實 GAS、LINE、Firebase 或瀏覽器 E2E。

---

# 3. 本版本範圍

## 3.1 必做範圍

1. 開發／合併／部署流程保護。
2. 前端結案污染修復。
3. Task 狀態相容與統一顯示。
4. Sheets、RTDB、LINE、Bridge 的結果契約，消除假成功。
5. LINE Webhook 與 Browser Bridge 的冪等控制。
6. GAS 與跨裝置新 ID 強化。
7. Demo／Drill／Production 環境隔離。
8. SOS 改為逐筆事件，不再互相覆蓋。
9. 關鍵資料的 `unknown / stale / fresh` 顯示。
10. Consent／Refusal 最小可行紀錄。
11. Firebase Rules、Test Channel 與真機 Smoke Test。
12. 文件真相來源同步與 Claude 交接規則。

## 3.2 本版本不做

- PostgreSQL 或自建正式 API 重寫。
- 微服務化或完整 Modular Monolith 重構。
- 完整 IndexedDB／Offline Outbox／跨裝置衝突協議。
- 完整跨通路身份系統。
- 完整後端 RBAC／ABAC 重建。
- 正式金援、心理、醫療特種個資作業。
- 正式多倉庫交易 Ledger。
- 多站點大規模同時協作。
- AI 自動派工、自動核准、自動結案或自動發警報。
- 大型 UI 改版、全站模組拆分或框架遷移。

---

# 4. Pre-Pilot 的簡化資訊流

本版本不再讓每個畫面自行判斷「可能有沒有成功」。所有可寫入動作統一成同一條資訊流。

## 4.1 LINE 寫入流程

```text
LINE Webhook Event
    ↓
verifyRequest（現有補償驗證）
    ↓
以 webhookEventId 去重
    ↓
normalizeCommand
    ↓
routeAction
    ↓
Required Sink：正式事件紀錄
    ↓
Optional Sink：Firebase 即時投影
    ↓
Optional Sink：LINE narrowcast／其他通知
    ↓
aggregateOutcome
    ↓
依完整成功／部分成功／失敗回覆使用者
    ↓
寫入處理結果與稽核
```

## 4.2 Browser Bridge 寫入流程

```text
使用者按下操作
    ↓
前端建立並保存 commandId
    ↓
loaBridgeSend(commandId, action, params)
    ↓
GAS 驗證 BRIDGE_KEY＋Allowlist
    ↓
以 commandId 去重
    ↓
共用 routeAction
    ↓
aggregateOutcome
    ↓
Bridge 回傳結構化結果
    ↓
前端依結果顯示：
送出中／完成／部分完成／失敗
```

網路 timeout 後重試必須使用同一個 `commandId`，不能重新產生 ID。

## 4.3 讀取流程

Pre-Pilot 不允許前端匿名讀取 Firebase 根節點。

```text
HQ 前端
    ↓
GAS Bridge Read（只允許白名單 projection）
    ↓
Firebase Test Project
    ↓
回傳非 PII 的 tasks / sos_events / rollcall / supply projection
    ↓
前端保守 merge，不以空資料覆蓋良好本機資料
```

本地 Demo 仍可使用 localStorage／模擬 RTDB，但畫面必須清楚標示環境。

---

# 5. Pilot 資料角色

為避免多重真相，本版本先給每個資料層單一職責。

| 層 | v4.1.0 職責 | 不得承擔 |
|---|---|---|
| LINE OA | 前線訊號輸入與回覆 | 個資資料庫、正式帳本 |
| GAS | 驗證、去重、Action routing、結果彙整 | 長期 UI 狀態 |
| Google Sheets | Pilot 支援 Action 的正式事件紀錄候選 | 即時多人畫面 |
| Firebase RTDB | 非 PII 即時 projection | 唯一正式帳本、完整個資庫 |
| `DATA` / localStorage | Demo、暫存、畫面與相容資料 | 正式多人交易真相 |
| GitHub | 程式、規格、錯誤帳本與交接 | 現場交易資料 |
| AI | 摘要、提醒、建議 | 直接產生不可逆交易 |

## 5.1 建議的 Pilot 決策預設

若 Mason 尚未另行拍板，v4.1.0 預設採：

- `事件紀錄_v2`：支援 Pilot Action 的 Required Sink。
- Firebase：Optional Realtime Projection。
- LINE：訊號與回覆。
- localStorage：Demo／本機顯示，不視為正式紀錄。

若不接受此資料治理預設，停止於 PR-2，不得繼續正式串接。

---

# 6. 共用資料契約

## 6.1 CommandEnvelope

LINE 與 Bridge 進入 Action router 前，統一轉成：

```javascript
{
  commandId: "stable-id",
  source: "line" | "bridge",
  sourceEventId: "LINE webhookEventId or bridge commandId",
  environment: "demo" | "drill" | "production",
  action: "sos",
  actor: {
    source: "line" | "web",
    actorRef: "LINE userId / member code / session reference",
    displayName: "optional"
  },
  incidentId: "optional",
  occurredAt: "ISO-8601",
  receivedAt: "ISO-8601",
  params: {}
}
```

現階段不得假定 `actorRef` 是正式 Person ID。

## 6.2 StorageResult

所有外部 Sink 統一回傳：

```javascript
{
  ok: true,
  skipped: false,
  sink: "sheets" | "firebase" | "line",
  operation: "append" | "put" | "push",
  statusCode: 200,
  reference: "path or row reference",
  error: null
}
```

未設定：

```javascript
{
  ok: false,
  skipped: true,
  sink: "firebase",
  reason: "not_configured"
}
```

失敗：

```javascript
{
  ok: false,
  skipped: false,
  sink: "firebase",
  statusCode: 500,
  error: "..."
}
```

## 6.3 ActionOutcome

```javascript
{
  ok: true,
  level: "success" | "partial" | "failed",
  commandId: "...",
  entityId: "...",
  requiredResults: [],
  optionalResults: [],
  userMessage: "...",
  retryable: false
}
```

Required Sink 失敗時不得顯示完整成功。

## 6.4 時間

所有新寫入至少存：

```text
occurredAt：ISO-8601
recordedAt：ISO-8601
updatedAtMs：epoch milliseconds（需要 freshness 時）
```

現有 `fmtTS()` 可繼續作 UI 顯示，但不得作唯一排序依據。

## 6.5 新 ID

內部新 ID 使用完整 UUID／ULID，短碼只作顯示。

範例：

```text
內部：01J2Y6NK8WQ4M2QAB3R7KDH6P9
顯示：REQ-20260716-8WQ4
```

不要改寫既有歷史 ID。

## 6.6 Task 狀態

Canonical code：

```text
pending
awaiting_acceptance
active
blocked
done
cancelled
```

Legacy mapping：

```text
待處理 / 待指派 / 待派工 / pending → pending
待確認 → awaiting_acceptance
進行中 / active → active
受阻 / blocked → blocked
已完成 / done → done
已取消 / cancelled → cancelled
```

實施 Gate：

1. 所有 reader 先使用 `normalizeTaskStatus()`。
2. 測試通過。
3. 才將新 writer 改寫 canonical code。
4. 舊 seed 與 localStorage 保持可讀至少一版。

---

# 7. 分階段工作包

# WP-0｜治理、合併與部署保護

## 目的

防止接上真實服務後，AI 修改未經審查直接進入 `main` 或正式部署。

## 主要檔案

- `CLAUDE.md`
- 可能的 GitHub Pages／Actions 設定
- 本交接文件

## 變更

- 移除「feature branch push 後自動 merge main」規則。
- 改成：
  - feature branch
  - 執行測試
  - 檢視 diff
  - Mason 明確核准
  - merge main
  - 另行執行 deployment
- 查證 GitHub Pages 是否直接使用 `main`。
- GAS deployment 與 Git commit 分離。
- 定義 `demo / drill / production` 的部署清單。

## 驗收

- feature branch push 不會自動 merge。
- 未經 Mason 核准不會修改 main。
- main push 不會自動更新 GAS Production deployment。
- 可列出每個部署使用的 commit SHA。

## 回滾

只回復 `CLAUDE.md` 規則，不涉及資料格式。

## 預估

0.5–1 個工作日。

---

# WP-1｜前端結案污染修復

## 已確認問題

`app.js::rtSubmitClose()` 會將同一份 RT 結案摘要寫入所有尚未結案 Case。

## 主要檔案與函式

- `app.js`
  - `rtCloseReport`
  - `rtSubmitClose`
  - `closePersonCase`
- `test_loa_integration.js`

## 變更

首選安全方案：

- 結案表單必須指定 `targetIncidentId` 或 `targetCaseId`。
- 更新條件：

```javascript
(case.incidentId || case.sosId) === targetIncidentId
```

- 無目標 ID 時拒絕送出。
- 以 `commandId`／結案 reference 防止重複 timeline。

若目前 UI 無法可靠選定目標：

- 暫時停止自動回寫 Case timeline。
- RT 結案只寫結案 projection 與 audit。
- Case 由個案頁分別結案。

## 驗收

- Case A 結案不改 Case B。
- 無目標 ID 無法送出。
- 重複送出不新增第二筆 timeline。
- 原本 `closePersonCase()` 流程不回歸。

## 回滾

保留原結案表單；只撤回 Case timeline 自動回寫。

## 預估

0.5–1.5 個工作日。

---

# WP-2｜Task 狀態相容層

## 已確認問題

Web、GAS、RTDB 與 Flex 卡同時使用 `active/done`、`進行中/待派工/已完成` 等不同值。

## 主要檔案與函式

- `app.js`
  - 任務 render／filter
  - `completeTask`
  - 結案任務計數
  - KPI／溯源 reader
- `gas/handlers.gs`
  - `handleTaskDone`
  - `handleSquadAccept`
  - 其他 Task writer
- `gas/push.gs`
  - `buildTaskFlex`
- 兩套 Node tests

## 變更順序

1. 新增 `TASK_STATUS`、`normalizeTaskStatus()`、`taskStatusLabel()`。
2. 盤點所有 Task reader。
3. 所有 reader 改用 normalizer。
4. 增加新舊狀態測試。
5. 測試通過後，才切換新 writer。
6. Legacy mapping 保留一版。

Supply 狀態本版本只建立字典文件與測試清單，不全面重寫 transition。

## 驗收

- 舊中文 seed 正常顯示。
- 新 canonical code 正常顯示。
- Flex 卡、任務列表、結案計數對同一 Task 給出同一答案。
- 未知狀態顯示「未知」，不自動當待處理。
- 既有接單／婉拒／完工測試全通過。

## 回滾

Reader normalizer 可保留；writer 可退回舊值，不需遷移資料。

## 預估

1–2 個工作日。

---

# WP-3｜外部儲存結果契約與假成功修復

## 已確認問題

- `appendRow()`、`rtdbWrite()`、`rtdbPush()` 未回傳可靠結果。
- `muteHttpExceptions` 後未檢查 Firebase response code。
- 部分前端操作在 Bridge 完成前直接 Toast 成功。
- `callLineAPI()` 雖記錄錯誤，呼叫端未必知道失敗。
- GAS `TextOutput` 無法提供真正 HTTP status control；本版本只保證 JSON outcome，不聲稱標準 HTTP 403。

## 主要檔案與函式

- `gas/sheets.gs`
  - `appendRow`
  - `rtdbWrite`
  - `rtdbPush`
- `gas/push.gs`
  - `callLineAPI`
  - `replyText`
  - `replyFlex`
- `gas/handlers.gs`
  - 支援 Pilot 的 Action handlers
- `gas/webhook.gs`
  - `handleBridge`
  - `doPost`
- `app.js`
  - `loaBridgeSend`
  - `loaSendBroadcast`
  - `loaPushTask`
  - 其他立即顯示成功的 Bridge 操作
- `test_gas_handlers.js`
- `test_loa_integration.js`

## 變更

- 所有 Sink 回傳 `StorageResult`。
- Handler 明確定義 Required／Optional Sink。
- Bridge 回傳 `ActionOutcome`。
- 前端必須等待結果再顯示。
- 使用者訊息分為：
  - 完整完成
  - 已正式登記但即時同步延遲
  - 未完成正式登記
  - 系統尚未啟用
- 測試 mock 可注入：
  - 200
  - 401
  - 403
  - 429
  - 500
  - timeout
  - exception

## Pilot Action 的 Required Sink 建議

| Action | Required | Optional |
|---|---|---|
| checkin | Event Log v2 | RTDB checkin projection |
| safe | Event Log v2 | RTDB safety projection |
| sos | Event Log v2 | RTDB sos event |
| supply request | Event Log v2 | RTDB supply projection |
| squad accept／decline | Event Log v2 | RTDB task／assignment projection |
| squad report／blocked | Event Log v2 | RTDB task／report projection |
| handover | Event Log v2 | RTDB handover projection |
| task done | Event Log v2 | RTDB task projection |

## 驗收

- Firebase 401／500 不顯示完整成功。
- LINE 429 不顯示「已送達」。
- Sheets Required Sink 失敗時回覆失敗。
- Optional Sink 失敗時回覆部分完成。
- Firebase 未設定時清楚標示未啟用。
- 前端不再先 Toast 成功。

## 回滾

可讓新函式結果被舊 handler 忽略，但不得回復無條件成功訊息。

## 預估

2–4 個工作日。

---

# WP-4｜Webhook／Bridge 冪等與 GAS ID 強化

## 已確認問題

- LINE redelivery 可能重複建檔。
- GAS `REQ-` 仍使用截短 `Date.now()`。
- Bridge timeout 重試目前沒有穩定 command ID。
- Sheets 與 RTDB 無跨系統 transaction。

## 主要檔案與函式

- `gas/webhook.gs`
  - `doPost`
  - event loop／`dispatch`
  - `handleBridge`
- `gas/handlers.gs`
  - 建立 entity 的 handlers
- `gas/sheets.gs`
  - 新增 Processed Event helpers
- `app.js`
  - `loaBridgeSend`
  - stable commandId cache
- `test_gas_handlers.js`

## 資料結構

新增 Sheet：

```text
Processed_Events
event_id
source
action
status
completed_sinks
entity_id
created_at
updated_at
last_error
```

狀態：

```text
processing
completed
partial
failed
```

LINE 去重鍵：

```text
event.webhookEventId
```

Bridge 去重鍵：

```text
payload.commandId
```

## 處理流程

- 使用 `LockService.getScriptLock()` 保護同一事件同時進入。
- 已 completed：直接回傳原結果。
- partial：只重試尚未完成的 Sink。
- failed：依 retryable 決定是否重試。
- RTDB 使用確定性 event path 或 entity ID，避免 redelivery 再 POST 新節點。
- 新 entity 使用完整 UUID／ULID。

## 限制

本方案提供「各 Sink 可重試且不重複」的有效冪等，不宣稱 Sheets＋RTDB 跨系統 exactly-once transaction。

## 驗收

- 同一 `webhookEventId` 三次只產生一筆正式事件。
- 同一 Bridge `commandId` timeout 重試只執行一次。
- 同一 Webhook request 內兩個不同 event 分別處理。
- Sheets 成功、RTDB 失敗後重試，不新增第二列 Sheet。
- 舊無 event ID 的本地測試明確使用測試 commandId，不使用每次新生成的 fallback。

## 回滾

保留 `Processed_Events`；不要刪除既有事件 ID，避免舊事件再度執行。

## 預估

2–4 個工作日。

---

# WP-5｜Environment Namespace

## 已確認問題

`?drill=1` 目前主要是畫面旗標，無法保證資料不寫入同一 DATA／RTDB。

## 主要檔案與函式

- `gas/config.gs`
- `gas/sheets.gs`
  - `_safePath`
  - RTDB adapter
- `gas/webhook.gs`
- `app.js`
  - drill mode
  - localStorage keys
  - RTDB mock adapter
  - reset functions
- tests

## 配置

GAS Script Properties：

```text
APP_ENV=demo | drill | production
```

前端在目前無 build system 的情況下使用獨立固定設定，例如：

```javascript
var APP_ENV = window.DRMS_ENV && window.DRMS_ENV.appEnv || "demo";
```

可由不同部署使用不同 `env-config.js`。不得由 LINE 參數、postback、Bridge params 或任意 URL query 切到 production。

## 路徑

```text
/environments/demo/...
/environments/drill/...
/environments/production/...
```

localStorage：

```text
drms_data_demo
drms_data_drill
drms_data_production
drms_rtdb_demo
drms_rtdb_drill
drms_rtdb_production
```

本版本先做 Environment scope，不強制所有節點使用 Incident path。

## 安全規則

- Production 禁止 `resetRTDB()`。
- 未授權匿名 GET `/.json` 失敗。
- 未授權匿名 PUT／POST 失敗。
- GAS credential 只可存取指定 env 與 allowlisted nodes。
- demo／drill／production 規則互相隔離。
- HQ 前端不得直接讀全庫。

## 驗收

- Drill 操作不出現在 Production。
- Demo seed 不進 Drill／Production。
- 切換環境不讀其他 localStorage。
- 外部 payload 無法指定 production。
- Production reset 被程式與規則雙重阻擋。

## 回滾

未產生正式資料前可回滾；一旦有正式資料，需搬移腳本，不得直接移除 prefix。

## 預估

1–3 個工作日。

---

# WP-6｜SOS 逐筆事件化

## 已確認問題

Web 與 GAS 都寫單一 SOS 節點，第二筆會覆蓋第一筆。

## 目標結構

只建立一份正典：

```text
/environments/{env}/sos_events/{sosId}
```

Record：

```javascript
{
  id: "...",
  status: "active" | "acknowledged" | "resolved",
  actorRef: "...",
  who: "...",
  detail: "...",
  incidentId: null,
  createdAt: "ISO",
  acknowledgedAt: null,
  acknowledgedBy: null,
  resolvedAt: null,
  resolvedBy: null
}
```

本版本不建立 `sos_current` 第二份 projection。前端由事件集合推導 active list 與最新事件。

## 主要檔案與函式

- `gas/handlers.gs`
  - `handleSOS`
- `app.js`
  - `triggerSOS`
  - `bindSOSListener`
  - `showSOSOverlay`
  - `dismissSOS`
  - 緊急頁 render
- tests

## 遷移順序

1. Reader 先支援：
   - 舊 singleton `/sos`
   - 新 collection `/sos_events`
2. UI 顯示 active list。
3. `dismissSOS(sosId)` 改為指定事件。
4. 新 writer 改寫 `/sos_events/{id}`。
5. 舊 singleton reader 保留一版。

## 驗收

- 兩筆 SOS 同時存在。
- 解除第一筆不影響第二筆。
- Overlay 顯示最新 active SOS。
- 緊急頁可看到全部 active SOS。
- 舊 singleton seed 可顯示。
- SOS 正式紀錄失敗時不得回覆「已送達指揮中心」。

## 回滾

保留 `sos_events`；舊 UI 可暫時只顯示最新一筆，但不得刪除歷史。

## 預估

2–3 個工作日。

---

# WP-7｜Unknown／Stale／Freshness 顯示

## 原則

業務狀態與資料品質分離：

```javascript
{
  status: "active",
  dataQuality: "fresh" | "stale" | "unknown" | "error"
}
```

不得把 `unknown` 當成正常綠色。

## 第一階段套用

- SOS
- 安全點名
- 志工目前狀態
- 道路狀態
- 收容床位
- 關鍵物資庫存
- 外部地震／氣象資訊

## 建議 TTL

| 資料 | TTL |
|---|---:|
| SOS | 10 分鐘 |
| 安全點名 | 30 分鐘 |
| 志工狀態 | 30 分鐘 |
| 道路 | 60 分鐘 |
| 床位 | 30 分鐘 |
| 庫存 | 120 分鐘 |
| 外部警報 | 依來源有效期限 |

## 主要變更

- 新資料寫入 `updatedAt`、`updatedAtMs`。
- 新增 `getDataQuality(record, ttlMs, now)`。
- UI 顯示：
  - 最後確認時間
  - 已過期
  - 尚無資料
  - 來源錯誤
- 跨日與裝置時鐘測試使用 epoch／ISO，不只解析 `HH:mm`。

## 驗收

- 缺時間顯示 unknown。
- 超過 TTL 顯示 stale。
- API 失敗顯示 error，不沿用 LIVE。
- 午夜前後不誤判。
- stale 不自動更改原業務 status。

## 回滾

可移除 Badge，不需修改既有業務資料。

## 預估

1–2 個工作日。

---

# WP-8｜Consent／Refusal 最小可行紀錄

## 目的

讓個案拒絕訪視、拍照、物資或心理轉介時，系統能尊重並正確記錄，不把拒絕誤判為任務失敗。

## 資料結構

```javascript
{
  type: "consent" | "refusal" | "restriction",
  service: "visit" | "photo" | "supply" | "psych_referral",
  reason: "...",
  actor: {
    source: "web" | "line",
    actorRef: "...",
    displayName: "..."
  },
  recordedAt: "ISO",
  active: true,
  supersedes: null
}
```

現階段 `actorRef` 不是正式 Person ID。

## 行為

- Case timeline 追加紀錄，不覆蓋舊決定。
- 新決定可 supersede 舊決定。
- 拒絕照片時，結案流程不得要求上傳個案正面照片。
- 敏感原因不推播給不需要知道的角色。
- Pilot 不啟用真實心理或醫療資料。

## 主要檔案

- `app.js` Case／visit／photo／referral 相關 render 與 action
- tests
- 必要時更新 `AUTH_MATRIX_SPEC.md` 的欄位顯示說明，不另建新授權系統

## 驗收

- 拒絕拍照不等於 Case 失敗。
- 撤回拒絕後可恢復相關操作。
- Timeline 保留完整前後歷程。
- 非授權角色看不到敏感 reason。

## 回滾

可停止 UI 新增，但保留既有 timeline 紀錄。

## 預估

1–2 個工作日。

---

# WP-9｜受控部署與真機 Smoke Test

## 部署順序

```text
Local Mock
→ GAS Development Deployment
→ LINE Test Channel
→ Firebase Test Project
→ Test Google Sheet
→ 3–5 個測試帳號
→ 受控現場演練
→ 是否進入下一階段的人工決策
```

## Pilot Action 分級

### Level A：Integration Sandbox

可測全部 22 Action，但：

- 全部為虛構資料。
- 只用測試帳號。
- 不連真實群組。
- 所有訊息標示 TEST。

### Level B：小型現場演練

只開放低風險 Action：

- checkin
- safe
- sos
- task acceptance／decline
- task progress／blocked
- supply request
- handover
- task done
- 必要的 narrowcast task push

預設停用：

- aid request
- psych referral
- 正式 case close
- 大量 broadcast
- 金援
- 真實個資匯出
- AI 自動執行

## Firebase Rules 驗收

- 匿名讀根節點失敗。
- 匿名寫入失敗。
- GAS 可寫 allowlist。
- HQ 只能透過 GAS 讀非 PII projection。
- 跨環境存取失敗。

## 真機 Smoke Test

1. LINE 傳「報到」。
2. 正式測試紀錄寫入一次。
3. RTDB projection 出現。
4. 重送事件不重複。
5. 接單／婉拒。
6. 進度／受阻。
7. 兩筆 SOS 同時存在。
8. 分別知悉與解除。
9. Firebase 失敗顯示部分完成或失敗。
10. LINE 429／Token 關閉不顯示已送達。
11. Drill 不寫 Production。
12. Bridge timeout 用相同 commandId 重試。
13. Case A 結案不改 Case B。
14. unknown／stale 顯示正確。
15. 系統控制範圍內資料可列舉、清除或標記作廢。

LINE 已送達訊息不列入「可完整刪除」保證。

## 預估

2–4 個工作日，不含 LINE／Google 帳號審核等待。

---

# WP-10｜文件真相與交接同步

## 問題

Repo 內 `ARCH_DOC`、Roadmap、Audit、FABLE 與實碼更新時間不同，容易再次形成多份互相衝突的 SSOT。

## 規則

每個 PR 完成後：

- `errors.md`：記錄新錯誤與通用教訓。
- 本文件：更新工作包狀態與實際差異。
- `GROWTH_ROADMAP.md`：只更新階段狀態，不重複全部技術規格。
- `SYSTEM_AUDIT_2026-07-09.md`：不持續當活動規格；新增日期化 audit 文件或補充 amendment。
- `AUTH_MATRIX_SPEC.md`：只有授權規則真正變更時更新。
- app.js 內 `ARCH_DOC`：
  - 要嘛同步更新；
  - 要嘛明確降級為 UI 展示摘要，不再宣稱 SSOT。

## Claude 每次工作回報格式

```text
工作包：
Branch：
Commit：
修改檔案：
實際完成：
未完成：
測試命令與結果：
真機驗證：
資料遷移：
回滾方式：
已知限制：
待 Mason 決策：
```

---

# 8. PR 順序與相依性

| 順序 | PR | 相依 | 風險 |
|---:|---|---|---|
| 0 | WP-0 合併／部署保護 | 無 | 低 |
| 1 | WP-1 結案污染 | WP-0 | 低 |
| 2 | WP-2 狀態相容層 | WP-0 | 中 |
| 3 | WP-3 Storage Result | WP-2 建議先完成 | 中 |
| 4 | WP-4 Idempotency／ID | WP-3 | 中高 |
| 5 | WP-5 Environment | WP-3 | 中 |
| 6 | WP-6 SOS Events | WP-4、WP-5 | 中高 |
| 7 | WP-7 Freshness | WP-5、WP-6 部分 | 低中 |
| 8 | WP-8 Consent／Refusal | WP-0 | 低中 |
| 9 | WP-9 Sandbox Deployment | WP-1～8 必要項 | 高 |
| 10 | WP-10 文件同步 | 貫穿全部 | 低 |

可以平行：

- WP-1 與 WP-2。
- WP-7 與 WP-8。

不得平行：

- WP-3 與 WP-4 的同一 GAS 檔案修改。
- WP-5 與 WP-6 的 RTDB 路徑切換。
- 同一路徑的 GitHub update／delete。

---

# 9. 測試策略

## 9.1 Merge Gate

每個 L2 以上 PR 至少執行：

```bash
node test_gas_handlers.js
node test_loa_integration.js
```

這兩套測試仍放在 Repo 根目錄；若未來移入 `tests/`，必須先修正 `__dirname` 相對路徑。

## 9.2 必補案例

### Storage

- Sheets throw。
- RTDB 401、403、500。
- LINE 429。
- timeout。
- Required 成功／Optional 失敗。
- Required 失敗／Optional 成功。

### Idempotency

- 同 webhookEventId 三次。
- 同 commandId 三次。
- partial 後重送。
- 兩個事件同一 request。
- 同時競爭 Lock。

### Status

- 中文 legacy。
- canonical code。
- unknown。
- illegal transition。

### SOS

- 兩筆同時。
- 分別解除。
- 舊 singleton 相容。
- 最新 active overlay。
- 全 active list。

### Environment

- demo／drill／production 不交叉。
- 外部參數不能切 production。
- Production reset 失敗。

### Freshness

- 缺時間。
- stale。
- 跨午夜。
- API error。
- 裝置時間偏移。

### Consent

- refusal 不等於 failure。
- supersede。
- 權限遮蔽。
- timeline 歷程。

## 9.3 測試限制

Node VM 無法代替：

- 真實 GAS Web App。
- Script Properties。
- LINE reply token。
- Webhook redelivery。
- Firebase Rules。
- Browser layout。
- 手機弱網。
- 高齡志工實體操作。

因此 WP-9 真機測試是必要 Gate。

---

# 10. Release Gate

## Gate G0｜治理

必須有人拍板：

1. 是否允許進行 Test Channel／Firebase Test Project。
2. Pilot Required Sink 是否採 `事件紀錄_v2`。
3. 技術維運 Owner。
4. 資料／個資 Owner。
5. AI 維持 Proposal-only。

## Gate G1｜程式

- 兩套 Node tests 全通過。
- 新增失敗測試全通過。
- 無已知 P0／P1 correctness bug。
- 所有 writer 有結果契約。
- 狀態 reader 全部經 normalizer。

## Gate G2｜資料安全

- Test Project 與 Production namespace 分離。
- Firebase 匿名 root read／write 被拒。
- 無真實特種個資。
- Bridge 只允許 allowlisted low-risk actions。
- `ALLOW_UNSIGNED` 在正式測試環境關閉。

## Gate G3｜真機

- 3–5 測試帳號完整跑完流程。
- 重送不重複。
- 兩筆 SOS 不覆寫。
- 假成功為零。
- Drill 污染為零。
- 有明確回滾與聯絡人。

## No-Go 條件

以下任一發生，不得進入現場演練：

- 外部寫入失敗仍顯示成功。
- 相同事件可重複建檔。
- Demo／Drill 可寫 Production。
- 第二筆 SOS 覆蓋第一筆。
- Firebase 可匿名讀全庫。
- 高風險或敏感 Action 未經限制可由 Bridge 執行。
- 無維運 Owner。
- 無法列舉與作廢測試資料。
- main 修改未經明確核准。
- 無法回滾到前一可運作 commit。

---

# 11. 現場使用順暢度的最小改善

本版本不做大改版，只做能直接降低誤解的改善。

## 11.1 全域環境條

```text
DEMO｜模擬資料
DRILL｜演練資料，不影響正式作業
PRODUCTION｜正式環境
```

## 11.2 同步狀態

```text
送出中
已正式登記
即時同步延遲
LINE 通知失敗
尚未啟用
```

## 11.3 資料品質

```text
已確認
已過期
尚無資料
來源錯誤
最後更新：14:20
```

## 11.4 每張卡的共同欄位

```text
狀態
下一步
負責人／actorRef
最後更新
資料品質
唯一主要動作
```

## 11.5 高齡使用者原則

- 不增加複雜欄位。
- 高風險流程仍用明確二選一。
- 錯誤訊息說明「資料是否已保留、是否要重做」。
- LINE 只做簡單選擇、報到、任務卡、安全、SOS 與回報。
- 複雜例外交由幹部／電話處理。
- 真正無網路與無手機情境仍需紙本備援；本版本不宣稱已完成完整離線。

---

# 12. AI 授權天花板

v4.1.0 中，AI 可以：

- 彙整。
- 找資料缺口。
- 標示 unknown／stale。
- 提醒受阻。
- 建議優先順序。
- 草擬推播與交接摘要。

AI 不可以直接：

- 建立正式物資需求。
- 自動派工。
- 自動核准高風險任務。
- 發布正式警報。
- 關閉 SOS。
- 結案。
- 核准金援。
- 修改或推斷敏感個資。

固定流程：

```text
AI Proposal
→ 人工檢視
→ 人工按下 Action
→ 系統留下 actor 與 audit
```

---

# 13. 預估投入

以下是單人＋AI、現有程式基礎下的粗略工程量，不含帳號審核與外部等待。

| 工作 | 預估 |
|---|---:|
| WP-0 | 0.5–1 日 |
| WP-1 | 0.5–1.5 日 |
| WP-2 | 1–2 日 |
| WP-3 | 2–4 日 |
| WP-4 | 2–4 日 |
| WP-5 | 1–3 日 |
| WP-6 | 2–3 日 |
| WP-7 | 1–2 日 |
| WP-8 | 1–2 日 |
| WP-9 | 2–4 日 |
| 文件與回歸緩衝 | 2–3 日 |

合計約 **15–29 個聚焦工作日**。若將 22 個 Action 一次全部正式化，成本與風險會顯著增加，因此 Pre-Pilot 僅正式啟用低風險 Action 子集。

---

# 14. v4.1.0 完成定義

v4.1.0-prepilot 不是「正式災害系統完成」，而是達到：

- 已建立安全開發 Gate。
- 已修結案污染。
- Task 狀態跨端一致。
- 支援 Pilot 的所有 Action 都能辨識完整／部分／失敗。
- LINE 與 Bridge 重試不重複。
- Demo／Drill／Production 隔離。
- 多筆 SOS 可同時存在。
- 關鍵資料不再把未知／過期畫成正常。
- 個案拒絕服務有最小可行紀錄。
- Firebase Test Rules 通過。
- Test Channel 真機 Smoke Test 通過。
- 無真實敏感資料。
- 有維運 Owner、回滾與交接紀錄。

完成後才根據真實測試資料決定：

- 是否擴大 Action。
- 是否需要 Operational Period 輕量版。
- 是否需要更正式身份。
- 是否需要真正離線同步。
- 是否有必要建立正式後端。

---

# 15. Claude 第一個建議執行單位

未收到「開始實作」前，只讀取與檢核，不修改程式。

收到開始指令後：

1. 建立 feature branch。
2. 只處理 **WP-0**。
3. 回報：
   - `CLAUDE.md` 建議差異。
   - GitHub Pages／部署關係查證結果。
   - 既有測試 baseline。
4. 停止，等待 Mason 核准。
5. 下一個獨立工作包才是 **WP-1 結案污染修復**。

不得一次執行全部計畫。

---

# 16. 版本紀錄

## Plan 1.0.0｜2026-07-16

整合並修正：

- Repo 全面架構與資料節點盤點。
- 兩輪 Find My Unknown。
- 使用者順暢度建議。
- 顧問檢核。
- 成熟度／成本校正回饋。
- Coding 可行性與回歸風險檢核。
- 計畫書幻覺稽核。
- 移除 PostgreSQL、微服務、完整 Offline Outbox 等現階段過度工程。
- 修正測試目錄、Bridge commandId、actorRef、SOS projection、ID 熵、APP_ENV 等不完整假設。
- 形成可由 Claude 分 PR 接手的 Pre-Pilot 執行基準。
