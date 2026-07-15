# Plan C — 條件式架構選項（Conditional Architecture）

> 三分計畫之一：[A 修復清單](PLAN_A_PRELAUNCH_FIXES.md) ｜ [B 治理決策](PLAN_B_GOVERNANCE_DECISIONS.md) ｜ **C 條件式架構**
>
> 定位：這些**不是 roadmap 項目、不排時程**。它們的方向沒錯，只是**現在沒有成立條件**。誤把「可能性」寫成「承諾」（例如「Phase 4 導入 PostgreSQL」）正是原計畫書的偏差。本檔把它們改寫成**架構岔路**：只列觸發條件、為何需要、何時重評估、不做的風險。
>
> **鐵則（否則本檔＝死文件）**：每條岔路的觸發條件必須有**指定的人、在指定的時機**去對照——否則「當出現多裝置寫入時重評估」永遠不會有人評估，這正是原計畫書 U2-20 描述的殭屍流程。檢查責任見文末。

---

## 全域重評估觸發條件（任一成立即重新評估正式化）

```
- 開始同時多裝置寫入同一資料
- 開始保存正式個資（非模擬）
- Sheets／GAS 出現配額或一致性問題
- 有了長期維運 owner（治理決策 ③）
- 出現第二個以上正式據點
- 需要正式庫存與金援交易
```

在上述條件發生前，**不預先建造重型基礎設施**。

---

## 岔路清單

### C1 — 正式後端（PostgreSQL + Modular Monolith）
- **觸發**：多裝置寫入衝突／開始存正式個資／需要交易一致性
- **為何需要**：交易保證、後端授權、集中稽核落地
- **不做的風險**：多重真相持續（現況 DATA↔RTDB 已有雛形）、無交易保證、前端權限可繞過
- **依賴治理**：B① 定位＝正式營運 且 B③ 有技術 owner；資料來源選 B②＝自建時直接對應
- **不建議微服務化**：Domain 邊界仍在收斂，過早拆服務會把不穩定邊界固化——若做，先 Modular Monolith

### C2 — Command / Event / Outbox 正式化
- **觸發**：需要可稽核的不可逆操作鏈（結案／核金援／發警報）
- **為何需要**：append-only 稽核（`FABLE_HANDOFF` 脊椎 C 已提「before/after + 雜湊鏈」）、對外整合的可靠投遞
- **不做的風險**：操作無法回溯、外部寫入無重試保證
- **依賴治理**：B④ 的 AI 天花板執法點落在這層的 commit 前；與 Tier 3 狀態機同一接縫
- **注意**：主系統 `app.js`（9,897 行）無 reducer／`commit(` 出現 0 次；`shelter/` 已有 reducer+單次 commit 可當**新子系統**基準，但套回主系統＝實質重構，非貼 pattern

### C3 — Offline-first 全套同步（IndexedDB + Outbox/Inbox + Conflict）
- **觸發**：真實現場弱網 + 多裝置離線寫入
- **為何需要**：離線是明文紅線第 1 條（`INFO_CHAIN`）
- **不做的風險**：弱網下資料遺失或衝突無解；目前只有 localStorage + BroadcastChannel（非真同步）
- **依賴治理**：需先有後端（C1）作為 server acknowledgement 對象

### C4 — 跨通路身份統一 + Break-glass
- **觸發**：同一人跨 LINE userId／QR 報到／帳號需綁定，且要正式權限
- **為何需要**：`FABLE_HANDOFF`「角色 vs 個人」「志工身分嚴謹度」已列為未解
- **不做的風險**：無法確認「此時此地誰有權下這道指令」；Break-glass 提權無稽核
- **依賴治理**：B③ 維運 owner（誰核發／撤銷憑證）
- **已有資產**：角色詞彙統一（`AUTH_MATRIX §4.1` R-HQ…R-VOL）已做；缺的是**人的身份綁定**，非角色

### C5 — 資源／金援 Ledger（多態庫存）
- **觸發**：需要正式庫存與金援交易
- **為何需要**：`on_hand/reserved/allocated/in_transit/…` 才能反映「有貨 ≠ 可用」
- **不做的風險**：庫存數字失真、跨單位資源承諾被重複計算
- **依賴治理**：B② 資料來源（交易落在哪）

### C6 — Capacity（虛擬化 / 分頁 / 大清單）
- **觸發**：真實資料量放大（>數百筆/站、數千志工）
- **為何需要**：現況 `app.js` 列表全 `innerHTML` 重繪 + 完整 `.map/.filter`、無虛擬化
- **不做的風險**：資料量大時畫面卡、手機記憶體不足、localStorage 超限
- **現況**：全是數筆種子資料，**屬潛在非當前風險**——條件未到不動

---

## 不納入 C 的原意提醒

以下原計畫書項目在此階段連「岔路」都不必列，屬過度模型化（等真有需求再說）：完整 `CommandAssignment`（scope inheritance/授權圖）、`FatigueAssessment` 實體、`ExternalCommitment/Reservation` 全流程、撤回指令完整流程、per-role `CompletionCriteria`、`RetentionPolicy/LegalHold` 完整實體（保留原則 `INFO_CHAIN` 已有）、`merge/supersede/void` 語意、Release/rollback/schema-compat、per-dependency DR runbook、Coverage/Unknown Map。

---

## 檢查責任（本檔的活化機制）

| 誰 | 何時 | 做什麼 |
|---|---|---|
| 技術 owner（待 B③ 指定；暫為 Mason） | 每次 `GROWTH_ROADMAP` 里程碑檢視 | 逐條對照上方觸發條件，成立則把該岔路移入正式排程並回填 B 相關決策 |

> 沒有這一列，Plan C 就是原計畫書 U2-20 的殭屍流程。指定人＋指定時機，岔路才會真的被檢查。
