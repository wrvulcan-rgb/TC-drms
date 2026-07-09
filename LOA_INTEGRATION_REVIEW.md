# Line OA × 資料串接 覆盤報告（2026-07-09）

> 範圍：index.html / app.js 的 Line OA 全部介面與資料流、gas/ 後端、相關規格（LOA_ROLES_SPEC、INFO_CHAIN_ADOPTION、FABLE_HANDOFF 脊椎A）。
> 本文件前半是覆盤結論，後半是本次強化內容與剩餘待辦。

---

## 一、覆盤結論：三段各自成立、中間斷鏈

| 段 | 現況（覆盤時） | 證據 |
|---|---|---|
| 前端模擬器 | **完整**：7 角色視角、LOA_ROLES_SPEC 全部按鈕已實作，含高風險守門、覆核閉環、交接快照 | app.js `loaVol*/loaLeader*/loaKitchen*/loaVisit*/loaStaff*/loaDriver*` |
| GAS 後端 | **真實但殘缺**：webhook/推播/Sheets/Firebase 程式可部署，但只有 8 個核心 ACTION | gas/config.gs（舊版 ACTION 表） |
| 兩端接線 | **零**：前端沒有任何 fetch 打向 GAS/LINE；本地 RTDB 是 localStorage mock，與真實 Firebase 從未橋接 | app.js 全檔 fetch 清單 |

### 覆盤發現的缺口（依嚴重度）

1. **前端↔後端完全斷鏈**（最大缺口）：兩端共用 ACTION 詞彙與 RTDB schema，卻沒有任何一條真實連線。
2. **驗簽形同虛設＋一部署就全掛**（資安＋正確性雙重問題）：
   - 舊版 `CHANNEL_SECRET` 未設時直接放行（fail-open）；
   - 更隱蔽的 bug：**GAS Web App 讀不到 HTTP header**，`X-Line-Signature` 永遠拿不到——一旦真的設了 secret 部署，所有 LINE webhook 會被 403 全拒。舊程式「未部署所以沒人發現」。
3. **LOA_ROLES_SPEC 的 14 個 ACTION 後端全缺**：班長 5（squad_accept/rollcall/report/blocked + handover）、司機 1（depart，模擬端按鈕也缺）、香積 2（meal_count/done）、訪視 4（visit_start/done、aid_request、psych_refer）、幹部 2（risk_approve、case_close）。
4. **dt6 已知 bug**：admin「Line OA 串接」卡片未渲染。根因＝非 admin 檢視後 `#admin-gate` 被鎖屏整段覆寫且無還原機制，切回 admin 時容器已毀，`renderLineCards()` 靜默 return。
5. **測試覆蓋偏斜**：18 組測試全在前端模擬，gas/ 零覆蓋；另有一筆過期斷言（金援 timeline type 改名後測試未跟上，`main` 上長期紅燈）。
6. 其他既有事實（未在本次處理）：照片只記 metadata 未上傳 Drive、後台頻道卡 toggleLine 為展示用模擬、LIFF/RichMenu 無實作、index.html 有一個良性多餘 `</div>`（在 arch-panel-v2 尾端、其後只剩 script，實測 DOM 20 個分頁全部正確掛在 `.main` 內）。

---

## 二、本次強化（全部已實作＋測試通過）

### A. GAS 後端補齊（gas/）

- **ACTION 8 → 22**：補齊規格書全部 14 個待串接 ACTION（config.gs 對照 LOA_ROLES_SPEC 串接點①〜⑧）。
- **統一動作路由 `routeAction`**（handlers.gs）：LINE postback 與 DRMS 橋接共用同一張路由表——「一個動作、兩個入口、同一組寫入」。
- **接單狀態機**（INFO_CHAIN_ADOPTION P1）：`squad_accept` 帶 `decision=accept|decline`，寫 `assignments/{taskId}` `{status, responded_ts}`，婉拒自動退回待派池。
- **關鍵字快捷輸入**：「開伙 120」「交接：…」「受阻：…」免選單直達 handler（高齡志工友善）。
- **新 Flex 卡**：`buildSquadTaskFlex`（接單/婉拒）、`buildRiskReviewFlex`（核准/駁回）。
- **廣播成本紀律**（INFO_CHAIN_ADOPTION P1）：`broadcast` 預設不打 LINE API 只留紀錄，有指名 `params.to` 才逐一 narrowcast push。

### B. 驗證改 fail-closed（webhook.gs）

```
1. 有簽名 → 嚴格 HMAC-SHA256 驗證
2. 設 WEBHOOK_TOKEN → 核對 Webhook URL 的 ?token=（GAS 讀不到 header 的補償控制，LINE 會原樣帶回 query）
3. 都沒有 → 僅 ALLOW_UNSIGNED='true'（開發）放行，否則 403
```
同時修掉「部署即全拒」問題：正式環境走 `?token=` 路徑，不再依賴拿不到的 header。

### C. DRMS 橋接模式（模擬 ⇄ 真實，前端 app.js＋webhook.gs）

- 後台「Line OA 串接」分頁新增設定卡：啟用開關／GAS /exec 網址／橋接金鑰／Firebase 網址／🩺 測試連線（打 `?action=health`）／⬇ 拉取 Firebase 現況（反向同步回中台）。
- **前端 22 個動作函式全部接上 `loaBridgeSend(action, params)`**：啟用後每顆按鈕同步 POST 至 GAS（`{source:'drms-bridge', key, action, params}`，text/plain 免 CORS 預檢）；GAS 端 `BRIDGE_KEY` fail-closed 驗證。
- **offline-first**（FABLE_HANDOFF 脊椎A 紅線）：未啟用＝行為與過去完全相同；串接失敗只記 log 絕不阻斷本地模擬。
- 各 Line OA 頁面新增模式徽章：「🧪 模擬模式」⇄「🔗 串接模式」，資料流說明頁同步改為雙模式圖。

### D. Bug 修復

- **dt6**：開機快取 `ADMIN_GATE_HTML`，切回 admin 時還原面板並重建全部動態內容；`switchTab('t-line'/'t-gmail')` 補渲染。含瀏覽器回歸測試。
- **司機補「🚚 出發回報」**：模擬端按鈕＋`loaDriverDepart()`＋GAS `DEPART`（需求單「已派案→配送中」帶出發時間，幹部/班長端看得到在途）。
- **過期測試斷言**：金援 timeline type「金援申請」→「金援·申請」（512ccf6 改名未同步），`main` 上的長期紅燈修復。

### E. 測試（全綠）

| 套件 | 內容 | 結果 |
|---|---|---|
| `test_gas_handlers.js`（新增） | GAS 沙箱 13 組：fail-closed／WEBHOOK_TOKEN／HMAC／橋接金鑰／25 動作全路由／接單狀態機／關鍵字／成本紀律／Flex 卡／health 不洩密 | ✅ 全過 |
| `test_loa_integration.js`（擴充） | 既有 18 組＋橋接 T19-T21（預設不外連／payload 格式／offline-first） | ✅ 全過 |
| 瀏覽器冒煙（Playwright） | 17 項：載入無錯／DOM 20 分頁掛載正確／雙手機＋徽章／dt6 回歸／串接 POST 實測／斷網不擋模擬 | ✅ 全過 |

---

## 三、剩餘待辦（需帳號或決策，程式端已就緒）

| 序 | 事項 | 卡在哪 |
|---|---|---|
| 1 | 部署 gas/ 至 script.google.com、設 Script Properties（含 `WEBHOOK_TOKEN`/`BRIDGE_KEY`） | 需 Google 帳號操作（步驟見 gas/SETUP.md） |
| 2 | LINE Official Account + Messaging API Channel 申請、Webhook URL 綁定 | 需 LINE 帳號與審核 |
| 3 | Firebase RTDB 專案（要真正即時推回前端需換 SDK；現有「拉取現況」為輪詢式） | 需 Firebase 專案＋FABLE_HANDOFF 六岔路之「資料落地境內外」決策 |
| 4 | 照片 → Drive 實際上傳與自動分類（現只記 metadata 佇列） | GAS 需加 Drive OAuth scope |
| 5 | 接單狀態機 timeout 30 分鐘遞補（INFO_CHAIN P1 的後半） | 需 GAS 時間觸發器（部署後設定） |
| 6 | LIFF 表單／RichMenu 雙入口 | 待工作坊定案按鈕文案後再做 |

**一句話總結**：覆盤前是「模擬完整、後端殘缺、兩端斷鏈」；本次把後端補到與規格書一比一、把驗證修成部署即可用的 fail-closed、並打通「網頁 ⇄ GAS」橋接讓每顆模擬按鈕都有真實出口——剩下的是帳號與部署，不再是程式。
