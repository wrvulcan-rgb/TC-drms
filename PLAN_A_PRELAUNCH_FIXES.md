# Plan A — 上線前修復清單（Pre-launch Fixes）

> 三分計畫之一：**A 修復清單** ｜ [B 治理決策](PLAN_B_GOVERNANCE_DECISIONS.md) ｜ [C 條件式架構](PLAN_C_CONDITIONAL_ARCH.md)
>
> 定位：這份取代原「架構整併大計畫」的執行主線，等同於 `GROWTH_ROADMAP.md` Phase 0 的**具體化**——不是重建架構，而是先讓現有原型在「第一次真實串接（LINE / Firebase / Sheets）」前安全、可信。
>
> 收錄範圍：**只放已由程式碼證實、接真後端前會直接造成錯誤、且不需推翻現有架構的項目**（Tier 1 正確性 + Tier 2 顯示層防呆）。企業級重建不在此，見 Plan C。
>
> 證據來源：2026-07-15 三路 fresh-context 程式碼稽核。file:line 為稽核當下位置，實作時以最新碼為準再核。

---

## 動手順序（≠ 風險優先序）

風險優先序是 假成功 > 狀態字典 > …，但**建置**要契約先行：

```
0. 先落地「狀態字典」共用常數  ← 契約基準，項1驗收與所有整合測試都靠它
1. 假成功修復（建在狀態字典之上）
2. Webhook 去重（選型依賴 治理決策 B②：資料來源）
3. Demo/drill/prod、SOS、前端結案污染、ID  ← 彼此獨立，可並行
4. Tier 2 四項  ← 前端就地做，可與上面並行
```

---

## Tier 1 — 正確性修復（接真後端 / LINE 前必修）

| # | 優先 | 項目 | 證據（稽核位置） | 修法 | 成本 | 依賴 | 驗收條件 |
|---|---|---|---|---|---|---|---|
| 1 | ★ | **假成功**：寫入未查 HTTP code 就回報成功 | `sheets.gs:66-89` `rtdbWrite/rtdbPush` 用 `muteHttpExceptions` 但不讀 `getResponseCode()`；`handlers.gs:302-322` 無條件 `replyText('✅…')`。（`push.gs:222 callLineAPI` 有查 LINE 碼但只 log） | 寫入查 response code，handler 依結果回報成功／失敗 | 低（2 函式＋呼叫點） | 建在 #2 契約上 | RTDB 回 401/404 時使用者收到**失敗**訊息，非 ✅ |
| 2 | ★ | **狀態字典不一致**（跨層契約已破） | GAS 混用 `'done'`(`handlers.gs:319`) 與 `'進行中/待派工/受阻'`(`handlers.gs:353,359,385`)；`push.gs:47-67 buildTaskFlex` 比對 `'done'/'active'/'pending'`（永遠不中）；前端 `app.js:1227` 篩 `status==='已完成'`（GAS 從沒寫過） | 建**一份** status code 常數表，Web / GAS / LINE Flex / RTDB 四層統一引用 | 中低 | — （**最先做**） | `buildTaskFlex` 正確渲染；跨層同一狀態值一致；無「篩不到」的死值 |
| 3 | ★ | **Webhook 去重**：無 idempotency | `webhook.gs:23-30 doPost` 逐筆 dispatch，全 repo 無 eventId/messageId 去重 | 建 seen-messageId／webhookEventId 去重表 | 中（需存儲） | **選型依賴 B②** 資料來源 | LINE 重送 3 次只建 1 筆 |
| 4 | | **Demo/drill/prod 未隔離** | RTDB 全寫扁平頂層路徑（`handlers.gs` 全篇）；`?drill` 已知有破口 | RTDB path 加 env/incident 前綴或 namespace | 中 | — | drill 資料不落入正式 namespace |
| 5 | | **SOS 單節點覆寫** | `handlers.gs:302 rtdbWrite('sos',…)` 單一頂層節點；`app.js:495` 同 | 改 `rtdbPush('sos',…)` 逐筆存（keyed by pushId/userId） | 低 | — | 兩筆並存 SOS 不互相覆寫 |
| 6 | | **前端結案跨個案污染** | `app.js:1236-1240` 迴圈把結案報告寫進**每一個**未結案 case 的 timeline。（後端 `handlers.gs:489-496` 為 per-case，**無**此問題——污染只在前端 mock） | 只寫目標 case | 低 | — | 結一案不動其他案 |
| 7 | | **ID 碰撞** | `app.js:22` 程式**自註**生日悖論碰撞；多處 `'REQ-'+Date.now().slice(-5)`、`'S'+Date.now()` | 換序號或 uuid | 低 | — | 高頻建立不碰撞 |

> 註：#3 排在 #4–7 之前不是因為便宜（它反而最需要存儲設計），而是**接真 LINE 前必須有**，否則首次重送就重複建案。它的實作選型（存 Script Cache／RTDB／Sheets）踩到 B②，B② 未定前先寫邏輯、選型留白。

---

## Tier 2 — 災害顯示層防呆（成本低、災害價值高，前端就地做）

| # | 項目 | 為何值得（現狀問題） | 修法 | 成本 |
|---|---|---|---|---|
| 8 | **`unknown/stale` 狀態** | 二元 `正常/異常` 會把「沒資料」畫成綠色。災害系統最危險的不是顯示錯，是**缺資料時仍呈現平靜完整的畫面** | 關鍵節點狀態改 `正常/異常/未知/已過期`；沒觀測到 ≠ 正常 | 低（顯示層） |
| 9 | **資料 Freshness** | 舊值被當現況（道路兩小時前中斷仍綠、床位一小時前的數字仍顯示） | 關鍵節點顯示「最後確認 14:20 · 需重新確認」，每類節點定 TTL：SOS 5–10min、志工位置 15–30min、床位 30min、道路 30–60min、現場庫存 1–2h | 低 |
| 10 | **Consent／Refusal** | 個案拒絕訪視／拍照／物資，目前只能標「任務失敗」，語意錯且不尊重意願 | 個案資料加 拒絕/限制 語意欄位，與「失敗」區分 | 低（資料語意＋UI） |
| 11 | **高風險指令回覆確認** | 推播送達 ≠ 被理解；高風險指令需要對方主動確認 | **只有**高風險指令要求 LINE 回覆確認題（**不做**全套 sent/delivered/read/ack/understood 分層） | 低–中 |

---

## 與既有規格的關係（避免重造輪子）

- 授權 / PII / 角色介面 / 離線 已在 `AUTH_MATRIX_SPEC.md`、`INFO_CHAIN_ADOPTION.md`、`FABLE_HANDOFF.md`（四脊椎）規格化——本清單**不重推**，只做「讓現有脊椎能安全落實」的前置修復。
- Tier 3（Operational Period 輕量版、指揮權當值+交接 log、Task/Supply 狀態機集中化）**不在本清單**——它們有增量價值但需設計，待 Plan B 治理方向定後再排。狀態機集中化應建在既有 `app.js:39 CASE_TRANSITIONS` 形式上。

## 完成的定義

每項修完需 fresh-context 驗收（逐條有證據，非「應該好了」），且前端改動走四寬度（375/390/768/1440）文字驗證。全部屬本 repo 可逆改動。
