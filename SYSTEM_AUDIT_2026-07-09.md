# TC-DRMS 系統稽核與強化報告（2026-07-09）

> 四路並行稽核（邏輯 bug／資安／資訊流斷點／效能死碼）＋資訊流串接骨幹落地。
> 本文件：① 已修清單 ② 資訊流串接成果 ③ 未修清單（含不修的理由）。

---

## 一、本次已修（全部含測試、瀏覽器實測通過）

### A. 資安（我上一輪的橋接引入的風險，優先修）
| 編號 | 問題 | 修法 | file:line |
|---|---|---|---|
| **F1** | **Critical**：Firebase 拉回的外部字串（sos.detail／reportLog.msg）未跳脫直灌 innerHTML，在總控 admin 工作階段執行任意 JS → 竊個資＋BRIDGE_KEY | 渲染端一律 `esc()`（含跳脫單引號） | `showSOSOverlay` app.js、`renderRTReport` reportLog 迴圈 |
| **F2** | `loaLog` 把 GAS 橋接回覆（res.error）未跳脫灌入 | `esc(msg)` | `loaLog` |
| **F8** | GAS `rtdbWrite` 路徑用 caseId/taskId/reqId 直接串接 → Firebase 路徑穿越（`caseId=../../sos`）／越權覆寫 | 新增 `_safePath()`：逐段移除 `. # $ [ ]`＋丟棄 `..`/`.`，保留 `/` 結構 | `gas/sheets.gs` |

### B. 邏輯 bug
| 編號 | 嚴重度 | 問題 | 修法 |
|---|---|---|---|
| **#1 (dt10)** | HIGH | 物資派案/整理站/資產調度的動作按鈕「點了畫面不刷新」——mutator 呼叫無參數 render，寫進隱藏且無法導覽的 `*-content`，使用者看的 `res-*` 永不更新 | 新增 `_liveTarget()`，無參數 render 改打「目前顯示中(.page.act)」的容器 |
| **#5** | MED（白屏根因） | 頂層 `JSON.parse(drms_config)` 無 try/catch，config 一損毀即中斷整支 app.js → 全站白屏無回復（正是 CLAUDE.md 錯誤帳本擔心的情境） | try/catch 回退預設＋與 DEFAULTS 淺合併補齊新欄位 |
| **#2** | MED | sorting/assets/drive/kitchen/field 不在 `DATA_KEYS`、mutator 也沒 `saveData()` → 收件/分類/資產借還/開伙 重整後全消失 | `DATA_KEYS` 補 5 鍵＋9 個 mutator 補 `saveData()` |
| **#3** | MED | `loaBridgePull` 用 Firebase 資料「整段覆蓋」本地 RTDB，空物件會清掉良好資料；未偵測 `db.error` 假成功 | 改逐鍵 merge、空物件/陣列跳過、偵測 `db.error`；併入 RTDB↔DATA 對帳 |
| **#6/#7** | LOW-MED | 任務 id `'T'+Date.now()%1000`（1000 桶）、`REQ-`（10 萬桶）生日悖論碰撞，`find` 只回第一筆 | 附加單調遞增 base36 尾碼 `_uniqSuffix()` |
| **#8** | LOW | `notifyTask(i)` 無索引防護，過期 index 拋未捕捉例外 | `var t=…; if(!t) return;` |

### C. 效能／死碼（安全刪除）
| 項 | 效果 |
|---|---|
| 刪 4 個 git 追蹤但零引用的死檔（`index_v4.0_20260622.html` 662KB、`drms_v4.html` 186KB、`arch-script.js.bak`、`arch-style.css.bak`） | repo −944KB |
| 刪 `LINE_OA_SIM_B64` 死 base64（零引用、無 `atob`） | app.js 658KB → 584KB（−12%） |

---

## 二、資訊流串接成果（本次核心）

**問題**：全系統宣稱五鏈（人力／需求／後勤／交接／金援），實際只有一條 de-facto 血緣 `sosId`，且只貫穿 `relief_req → task → case` 前半段；LINE OA 報到孤立、接單狀態機唯讀孤兒、四項 KPI 一個都算不出、RTDB↔DATA 兩套真相不對帳。

**做法**：把 `sosId` 升級為貫穿全系統的 `incidentId` 血緣鍵（純附加、不改既有行為）：

1. **鑄造**：`reliefSpawnTaskAndCase` 產生任務/個案時打上同一 `incidentId`＋epoch `createdTs`（KPI 原料）。
2. **傳遞**：叫料單（依 caseId 掛回）、GAS 接單 assignment（帶 `incident_id`）都串上同一鍵。
3. **匯集**：`lineageCollectIncidents()` 以 incidentId 為鍵，把 relief_req／DATA 任務／RTDB 任務／assignment／個案 timeline／物資單，串成單一 S1–S9 血緣圖。
4. **KPI**：`computeKpiSummary()` 純由時間戳導出四指標——動員時效、接單回應率、到位率、結案時長（`_parseAnyTs` 容錯解析混雜時間格式）。
5. **視圖**：即時調度中台新增「🔗 溯源/KPI」分頁（`renderRTTrace`），每個事件可展開看它橫跨 通報→派工→接單→物資→歷程→結案 的完整血緣。
6. **對帳**：`lineageReconcileFromRTDB()` 把 GAS/LINE OA 端寫入 RTDB 的結案狀態，保守併回 DATA 正典（修斷點 #7），已接進「⬇ 拉取 Firebase 現況」。

**成果**：LINE OA／報到／物資／個案／金援各資訊流，現在能在單一視圖依 incidentId 端到端溯源，並產出四項 KPI。

### 資訊流模式升級：發送 → 回流 → 搜集 → AI 判讀 → 行動（閉環）
把原本「幹部單向發送」升級為完整回饋閉環，並在總部端補上判讀階段：

```
幹部發送（廣播/點名/派工/叫料）
    ↓  narrowcast（成本紀律：不用 broadcast API）
前線各角色 LINE OA 回流（報到/安全/叫料/進度/香積/訪視）
    ↓  依訊號類型彙整
總部 LINE OA 資料搜集區（即時調度中台 → LINE OA → 🏢 總部搜集）
    ↓  交叉比對 報到率 × 回應率 × 物資缺口 × 任務受阻 × KPI
🤖 AI 判讀與分析（① 彙整 → ② 研判 → ③ 分級建議＋信心度）
    ↓  一鍵行動 / 推播研判摘要給幹部群
指揮決策回到發送端（閉環）
```

- **總部搜集區**（`renderLOACollect`）：六格即時回流統計（報到/點名/叫料/任務/香積/訪視），全部讀真實 DATA/SAFETY/RTDB。
- **AI 判讀**（`loaAIAnalyze`）：對回流訊號做**真實交叉比對**（非造假）——SOS→危急、回應率<70%→補位、物資紅燈→調度、任務受阻→協調，輸出分級研判、可執行行動與模擬信心度；分三階段（收集→研判→建議）呈現 AI 過程。
- **接 Agent API 的落點**：判讀引擎現為規則引擎 demo，`loaAIAnalyze` 即真實部署接生成式 Agent API 的單一接點（對齊 app 既有「AI 戰術分析入口」規劃），輸入＝結構化回流訊號，輸出＝研判＋建議。

---

## 三、未修清單（已評估，列理由）

### 架構性——需後端才能根治（FABLE_HANDOFF 脊椎 A）
| 編號 | 問題 | 為何不在前端修 |
|---|---|---|
| F4/F6 | `role` 前端可變、`maskPII` 僅畫面層 → console 設 `role='admin'` 全解鎖 | 需後端存取層驗證，前端無法根治（系統已自承） |
| F3 | 身分證/電話明文存 localStorage/備份/RTDB | 需後端欄位級加密；前端遮蔽非加密 |
| F10 | BRIDGE_KEY 明文存瀏覽器並隨每次請求送出 | 瀏覽器驅動橋接之固有性；緩解靠金鑰最小權限＋輪替 |
| #4 | `?drill=1` 演練無資料隔離，寫進正式 DATA | 需寫入層統一 drill namespace，屬跨模組改造，風險高 |

### 可修但有回歸風險——建議獨立 PR＋回歸測試
| 編號 | 問題 | 風險 |
|---|---|---|
| F7 | 授權守門不對稱（`rtDoAssign`/`applyWelfare`/`rtForceTop`/`deleteRole` 無 `can()`） | 需逐一核對 AUTH_MATRIX ACT-id，套錯會擋掉正常操作 |
| F13 | Leaflet unpkg 無 SRI | 補 integrity 雜湊若值錯會直接讓地圖全掛；建議 self-host |
| 死頁 | 8 個 orphan `page-*` HTML（case_mgt/care_rec/…） | CLAUDE.md 前車之鑑：刪 HTML 曾致 div 失衡全站塌陷，須逐一驗證配對 |
| 內聯 style | app.js 內聯 style ~69KB 可抽 class | 量大，需視覺回歸 |
| 計時器 | `stopRegPolling` 從未呼叫、`rtCheckFatigue` interval 未 clear | 需改 showPage 生命週期，屬行為變更 |
| saveData | 每次全量序列化＋三重備份 | debounce 涉及資料還原語意，須保留可回復性 |

### 低優先
- F11 doGet health 未驗證揭露部署布林狀態（不含金鑰值）
- F14 QR 送第三方 api.qrserver.com（建議改本地產生器）
- USGS 地震 fetch 三處重複、無退避、空吞錯 → 建議單一 fetch＋快取＋retry

---

## 四、LINE OA 資安強化建議（可執行清單，依優先序）

### 資安分層架構（總原則 · 回應資安疑慮）
**LINE OA 只做即時資料串接，不當資料庫。** 分兩層：
- **① 即時串接層 · LINE OA**：只傳「訊號」（報到/安全/叫料/派工＋個案編號/志工編號/時間），**不帶身分證與完整個資**；可拋棄、可重建，非真相來源。
- **② 資訊層 · Google Sheets**：系統紀錄／個資治理的唯一真相；名冊、個資、核銷帳、歷程落地於此，靠 Google 帳號權限＋共用控管＋存取軌跡保護。
- 中間 Firebase RTDB 是**暫態快取**（中台即時同步用），非儲存層。

**為何這能回應「LINE OA 資安」疑慮**：把 LINE OA 的信任邊界縮到最小——它是一根管子不是保險箱。萬一 LINE 端／webhook 遭入侵，外洩面僅止於當下訊號，碰不到個資庫；個資的資安責任落在成熟的 Google 權限治理，而非 LINE bot token。此模型已呈現在系統內「Line OA 模擬 → 資料流說明」頁。落地要點：訊號最小化（只送 id 不送 PII）、個資查詢一律後端持 Sheets 權限自行查、回覆不夾帶他人個資。

---

橋接把「外部低權限輸入」接到「總部高權限渲染＋真實推播/寫入」，資安須以**縱深防禦**處理，不能只靠單點。以下每項標注負責層與可否現在做。

### P0 — 已在本次落地（程式端）
- ✅ **渲染端一律跳脫**：所有 LINE OA 回流字串（sos/reportLog/AI 判讀輸出/搜集區）經 `esc()`，杜絕儲存型 XSS（F1/F2）。**紀律**：日後任何顯示 LINE/Firebase 回流資料的新程式，一律先 `esc()`。
- ✅ **GAS 路徑消毒**：`_safePath()` 中和 Firebase 路徑穿越與非法字元（F8）。
- ✅ **webhook fail-closed**：無簽章／無 `WEBHOOK_TOKEN`／未開 `ALLOW_UNSIGNED` 一律 403。
- ✅ **成本＋隱私紀律**：廣播預設不打 LINE broadcast API，僅指名 narrowcast；AI 研判摘要走同一路徑。

### P1 — 部署前必做（設定 / 後端層，非程式）
1. **Firebase 安全規則收緊**：目前 `loaBridgePull` 用 `/.json` 無 auth 即讀整庫 → 代表規則世界可讀。改為**僅認證服務帳戶可讀寫**，前端改走 GAS 代理讀取（不直連 RTDB），或至少 per-node 規則 + 短期 token。這一步同時消除 F5（整庫 PII 被拉進前端）。
2. **`WEBHOOK_TOKEN` 移出 query**：query 會進日誌/Referer。遷移到真伺服器後改用標準 `X-Line-Signature` HMAC 標頭驗簽；留在 GAS 期間，token 至少定期輪替。
3. **`BRIDGE_KEY` 最小權限 + 輪替**：橋接金鑰明文存瀏覽器（F10 固有）。緩解＝該金鑰只授權「寫入受限節點」，不得用於任意 LINE push；定期輪替；正式改由登入後端代發，不放前端。
4. **關閉 `ALLOW_UNSIGNED`**：正式環境務必不設（否則偽造事件可繞過 BRIDGE_KEY 取得同等寫入/推播，F9）。

### P2 — 縱深防禦（需後端才能根治，納入脊椎 A）
5. **輸入端消毒**：GAS 收到 LINE 使用者文字（detail/note/reason）落 Firebase 前先去除 `<>`，與渲染端跳脫形成雙保險。
6. **PII 最小化**：總部搜集區與 AI 判讀**只用聚合量與去識別化欄位**（已如此設計——顯示人數/比率而非姓名）；備份（drms_backup/slot）改存去識別化或加密，縮小 F3 暴露面。
7. **AI 判讀輸出可追溯**：判讀結果標注「資料來源＋時間戳＋引擎版本」，接 Agent API 後保留 prompt/回應稽核，避免 AI 建議無法歸因。
8. **後端授權層**：`role` 前端化（F4/F6）根治須靠後端 session 驗證；補齊不對稱守門（F7，`rtDoAssign`/`applyWelfare` 等）時逐一對照 AUTH_MATRIX ACT-id。

### P3 — 供應鏈 / 離線韌性
9. **移除 CDN 相依**：Leaflet/字型/QR 改 self-host（同時修 F13 無 SRI 與離線優先違背）；QR 改本地產生器（F14）。

---

## 五、驗證
- `test_gas_handlers.js`：15 組（新增 G14 路徑注入防護、G15 血緣 incident_id）✅
- `test_loa_integration.js`：24 組（新增 T22 血緣鑄造/匯集、T23 KPI/溯源/XSS、T24 總部搜集＋AI 判讀/XSS）✅
- Playwright 冒煙：溯源分頁＋dt10＋持久化＋config 容錯＋F1 XSS 共 8 項 ✅；總部搜集＋AI 判讀 5 項 ✅；LOA 橋接 17 項無回歸 ✅
