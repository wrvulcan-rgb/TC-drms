# TC-drms 流程架構優化調查報告

調查日期：2026-07-04　分支：`claude/workflow-optimization-pxwef6`
性質：純調查，**未刪改任何既有檔案**，只新增本檔。

---

## 衝突待裁決

### 衝突 1：三份 HTML 各自獨立，非同一份的版本迭代

**證據：**
- `index.html`（1194 行）：模組化骨架，`<link>/<script>` 外部引用：
  - `style.css`（index.html:8）
  - `arch-style.css`（index.html:967）
  - `arch-script.js`（index.html:1072）
  - `arch-script-v2.js`（index.html:1169）
  - `app.js`（index.html:1192）
  - 最新 commit：`73e5996`（2026-07-02），且 commit 歷史密集（近一週內十餘次）。
- `drms_v4.html`（3120 行）：自含式單檔（無外部 js/css 引用，僅 Google Fonts），最後改動 `7cc20cc`（2026-06-10，Add files via upload），是三者中最舊、最久未動的。
- `index_v4.0_20260622.html`（8844 行）：自含式單檔，最後改動 `8120716`（2026-06-28，整合原型 A/B/D）。
- 兩兩 diff 行數：index.html↔drms_v4.html 3447 行、index.html↔index_v4.0_20260622.html 8087 行、drms_v4.html↔index_v4.0_20260622.html 6531 行 —— 三者內容互異程度接近檔案總行數，**非同源版本差異，是三個不同世代的原型**。
- 關鍵佐證：`ARCH.md` 記載的拆檔對照「arch-script.js ← 原 L1788–2285」「app.js ← 原 L2290–8842」，精確對應到 `index_v4.0_20260622.html` 的 `<script>` 位置（該檔第 1788、2290 行恰為 `<script>` 標籤）。即 **`index_v4.0_20260622.html` 是被拆分出 index.html 模組化架構的來源母檔**。

**建議選項：**
- A（建議）：`index.html` 為現行主線（唯一持續開發、模組化、被 ARCH.md 記錄拆分過程），`drms_v4.html`／`index_v4.0_20260622.html` 降為歷史封存。
- B：三者並存作為不同展示原型，各自維護。

**建議理由：** commit 活躍度與 ARCH.md 的拆檔記錄都指向 index.html 是唯一在演進的主線，另兩者已無人更動超過 6–24 天。**待 Mason 裁決。**

---

### 衝突 2：ARCH.md 與現行 arch-script.js 內容有落差（非致命，但文件已過期一部分）

**證據：**
- `ARCH.md` 最後更動 `8120716`（2026-06-28），描述的是「檔案結構拆分」與 v1 心智圖腳本大綱，全文不含 `班長`／`incidentOps`／`casePanel` 關鍵字（比對結果均為 0 命中）。
- `arch-script.js` 之後又經歷 `5f760b3`（2026-06-29）「fieldgroup 拆為 incidentOps + casePanel（雙 Aggregate Root）」的重構，現檔內 `incidentOps`／`casePanel` 命中 20 次。
- 即 **ARCH.md 描述的檔案佈局仍準確，但未反映次日對 arch-script.js 內部資料模型的重構**。
- 相對地 `ARCH_V2_SPEC.md`（最後更動 `86ae29a`，2026-06-29「重建 arch-script-v2.js 為 Task 中心五鏈架構 (v6.0)」）與現行 `arch-script-v2.js` 高度吻合（`班長`關鍵字 ARCH_V2_SPEC.md 13 次、arch-script-v2.js 19 次，佈局描述一致）。

**建議選項：**
- A（建議）：ARCH.md 補一段「arch-script.js 已於 2026-06-29 重構為 incidentOps/casePanel 雙聚合根，細節見 commit 5f760b3」，避免下次看 ARCH.md 誤判 v1 心智圖資料模型。
- B：不補，靠 git log 追。

**建議理由：** ARCH.md 開頭自述「本文件是 Claude 的導覽索引，每次談修改前先指這裡定位」——若內容過期會直接誤導後續 session。**待 Mason 裁決。**

---

## 廢檔候選

| 檔案 | 證據 | 建議動作 |
|---|---|---|
| `drms_v4.html` | 最後改動 2026-06-10，之後零更動；自含式，未被任何其他檔案引用（非 index.html 的依賴）；與 index.html 內容互異達 3447 行 diff | 歸檔（移至 `/archive` 或加註淘汰日期），暫不刪 |
| `index_v4.0_20260622.html` | 已被拆分為 index.html 模組化架構（ARCH.md 有明確拆檔記錄），拆分後本體再無被引用；最後改動 2026-06-28，之後所有開發都在 index.html 上進行 | 歸檔，作為拆分前的歷史快照保留 |
| `arch-script.js.bak` | 與正本 diff 238 行，落後正本一個 commit（`5f760b3` fieldgroup 重構未反映在 .bak），無任何檔案引用 `.bak` | 刪除（純備份殘留，git history 已保留舊版） |
| `arch-style.css.bak` | 與正本僅差 4 行（幾乎同步），無任何檔案引用 | 刪除（git history 已可還原，.bak 冗餘） |

（以上皆**待 Mason 裁決**，本次調查未刪改任何檔案。）

---

## 死碼/TODO 清單

### b. arch-script.js / arch-script-v2.js 引用狀況
兩者**皆非死碼**——都被 `index.html` 引用，且是刻意並存的雙版本 Tab 切換設計：
- `index.html:1072` `<script src="arch-script.js">` → Tab「🗺️ 現有架構 v4.0」（`index.html:970` 定義按鈕）
- `index.html:1169` `<script src="arch-script-v2.js">` → Tab「🪖 班長制強化版 v5.0」（`index.html:971` 定義按鈕）
- 兩者透過 `switchArchTab()`（index.html:1176-1189）互斥顯示，非重複代碼。

### f. app.js 的 TODO/FIXME
**與任務假設不符的重要發現：** app.js 全文搜尋 TODO/FIXME（含大小寫），**實際只有 1 處真正的程式碼待辦標記**，並非題目預期的 13 處：
- app.js:538 — `// 暫行規則：僅民眾求助類型「搶救」自動標記 riskProfile='high'；正式分級表待 TODO-WORKSHOP-17 工作坊產出後取代。`

其餘所有 "todo/Todo/TODO" 命中（約 30 處，行號含 116, 247, 5372, 5378, 5395-5440 等）都是**「待辦事項」UI 功能本身的變數/函式名稱**（`TODOS`、`toggleTodo()`、`delTodo()`、`toggleArchTodo()` 等），非程式碼待辦標記，不應計入 TODO 清單。**FIXME 全文 0 命中。**

---

## 規範衝突

### CLAUDE.md 部署規則 vs 本次 session 分支限制
- `/home/user/TC-drms/CLAUDE.md` 明文規定：任何 `git push origin <feature-branch>` 完成後應自動接續 `git checkout main && git pull --rebase origin main && git merge <feature-branch> --no-edit && git push origin main`，並記錄了一筆錯誤帳本（2026-06-29：push 後未自動 merge main 曾被判定為錯誤）。
- 本次任務指示明文要求：**只 push 到 `claude/workflow-optimization-pxwef6`**，並指示「忽略 repo CLAUDE.md 的『push 後自動 merge main』規則——本 session 的環境約束明文禁止 push 到指定 branch 以外的分支」。
- 本次執行**依任務指示為準，未 merge/push main**，僅 push feature branch。此為 session 層級指令覆蓋 repo 層級 CLAUDE.md 規則的明確案例，記錄於此供 Mason 之後裁決是否要調整 CLAUDE.md 的規則措辭（例如加註「除非 session 明確禁止」的例外條款）。

### WORKSHOP_*.md 定性（d 項）
五份 `WORKSHOP_0406/B/C/D/E.md` 皆為**尚未執行的工作坊議程草稿**（TODO_WORKSHOP.md 中對應場次狀態全部是「⬜ 待排期」），非「已開完的一次性會議紀錄」：
- WORKSHOP_0406/B/C/D.md 均被 `TODO_WORKSHOP.md` 以「議程草稿：見 `WORKSHOP_X.md`」明確連結引用。
- WORKSHOP_E.md 未被檔名直接連結，但其內容（各地啟動 Onboarding）與 TODO_WORKSHOP.md 第 209 行「場次 E　各地啟動與系統 Onboarding」章節主題一致，屬於同一份規劃的對應文件，非孤立廢檔。
- 結論：五份皆為現行有效的規劃文件，**無廢檔候選**。

### ARCH.md vs ARCH_V2_SPEC.md 範疇（e 項，非衝突，補充說明）
- `ARCH.md`：描述整體檔案拆分架構（index.html/style.css/arch-style.css/arch-script.js/app.js），對應 **v1「現有架構」Tab**。
- `ARCH_V2_SPEC.md`：描述 `arch-script-v2.js` 的 Task 中心五鏈重建規格，對應 **v2「班長制強化版」Tab**。
- 兩者範疇互補而非衝突，`ARCH_V2_SPEC.md` 與現行 arch-script-v2.js 高度吻合；`ARCH.md` 檔案佈局仍準確但未記錄 06-29 的 incidentOps/casePanel 重構（見「衝突 2」）。

---

## 附錄：三份 HTML 引用清單原始證據

```
index.html:8     <link rel="stylesheet" href="style.css?v=20260628g">
index.html:967   <link rel="stylesheet" href="arch-style.css">
index.html:1072  <script src="arch-script.js"></script>
index.html:1169  <script src="arch-script-v2.js"></script>
index.html:1192  <script src="app.js?v=20260629b"></script>

drms_v4.html            — 無外部 js/css（僅 Google Fonts CDN），inline <script> at line 1063
index_v4.0_20260622.html — 無外部 js/css（僅 Google Fonts CDN），inline <script> at line 1788, 2290
```
