# TC-DRMS 安全修復 Runbook

> 給「之後執行的模型/人」照做的步驟流程。搭配 `SECURITY_REVIEW_0706.md`（為什麼）。
> 現況前提（Mason 2026-07-06 確認）：正式環境 **`CHANNEL_SECRET` 應該還沒設**、LINE webhook 尚未真正上線（掃描亦顯示 real webhook 0%、目前用模擬器）。→ 未上線 = 可安心改 fail-closed，不會擋到真流量。
> 標記：🖐️=需人在外部 console（GAS/LINE/Cloudflare）操作 / 🤖=模型可在 repo 內完成。

---

## 分兩軌
- **A 軌｜現在就能無漏洞**：GAS 接觸點 + 前端轉義（H1/H4/M1/M2）。與脊椎 A 後端無關，做了不白工。
- **B 軌｜等後端（脊椎 A）**：C1 前端授權、H3 PII 加密——需要真後端才能根治，屬工作坊層級專案，不在本 runbook。
- **C 軌｜未來開 public 前的清單**：見文末 §未來 public。

---

## A 軌步驟

### STEP 1 🖐️🤖 LINE webhook 驗簽（H1）— 這是架構決策，不是一行改
**根因**：GAS Web App 的 `doPost(e)` **讀不到 HTTP header**，而 LINE 的 `X-Line-Signature` 是 header。所以「在 GAS 內驗 LINE 簽章」架構上不可能成立——現行從 `e.parameter` 取簽章永遠拿不到，一旦 `CHANNEL_SECRET` 設了、驗簽啟用，反而會擋掉所有真流量（這正是目前沒人敢設 secret 的原因）。

**無漏洞做法（擇一，建議 (a)）：**
- (a) 🖐️ 前置一層 **Cloudflare Worker** 當 LINE webhook 入口：Worker 能讀 header → 用 `CHANNEL_SECRET` 做 HMAC-SHA256 constant-time 驗簽 → 通過才轉發給 GAS（附一組 Worker↔GAS 的共享密鑰）。與 disaster-response-center 已用的 Cloudflare 生態一致。
- (b) 🖐️ 整條 webhook 收在 Worker/Cloud Function，GAS 只留「寫 Sheets 的內部 API」且要求共享密鑰 header。

**GAS 端同步改（🤖，`gas/webhook.gs`）：**
1. **fail-closed**：`CHANNEL_SECRET`（或 Worker 共享密鑰）未設 → `doPost` 直接回 401 並 `logSys('CONFIG_ERROR')`，**刪掉 `if(!CHANNEL_SECRET) return true`**。設定缺失一律拒收。
2. 驗簽移到 Worker 後，GAS 改驗「Worker 共享密鑰」而非 LINE 簽章。
3. 用 `e.postData.contents` 原始字串比對，勿用被 GAS 重序列化的 body。

**上線順序（重要）**：先部署 Worker 並在 LINE Developers 後台把 webhook URL 指到 Worker → 設好 `CHANNEL_SECRET` → 再把 GAS 改 fail-closed。順序反了會在切換空窗擋掉流量（雖然現在沒真流量，養成正確順序）。

### STEP 2 🖐️ 查 GAS 部署權限（H2 前置）
GAS 編輯器 → 部署 → 管理部署 → 確認 Web App 存取權：
- 若為 **「任何人（Anyone）」** → 這個 `/exec` 是無認證的 PII 讀寫入口，必須改：webhook 走 STEP 1 的 Worker 後，GAS Web App 存取權收為「僅本人」或要求共享密鑰。
- 記錄目前設定值回報 Mason。

### STEP 3 🤖 硬編 GAS 部署 URL 治理（H2）
`app.js:3744`、`index_v4.0_20260622.html:4640` 的 `REG_API_URL`：
- 短期：不外露真實 `/exec`，改打 STEP 1 的 Worker endpoint。
- 開 public 前務必完成（否則等於公開端點，見文末）。

### STEP 4 🤖 intake 明文密碼（H4）
`intake.html:83,232`：移除 `const ADMIN_PASSCODE=...` 與 `pass===ADMIN_PASSCODE` 的等同密碼常數。管理動作的授權改由 STEP 1 的 GAS/Worker 帶共享密鑰驗證；前端只保留「防誤觸」確認框。**先確認部署版的 `ADMIN_PASSCODE` 是否已被填成真值**——若是，該值已隨前端外洩，須立即在後端作廢。

### STEP 5 🤖 XSS 統一轉義（M2）
1. 確認/建立單一 `escHtml()`＋`escAttr()` helper（屬性用要含 `"` `'`）。
2. 掃 `app.js` 與 `drms_v4.html` 所有把資料插進 DOM 的點，優先修：
   - `app.js:4138` `value="${m.title}"` → `escAttr`
   - `app.js:1332` `cat.name` → `escHtml`
   - `drms_v4.html` 43 處裸 `innerHTML` → 改 `textContent` 或過 helper
3. **驗證（CLAUDE.md 規則）**：前端改動完成跑 Playwright 文字驗證（元素可見/按鈕綁事件/分頁不重複/console 無錯，375/390/768/1440 四寬度）。
4. code review 規則：日後新增任何 `innerHTML =` 一律過 helper，否則擋 PR。

### STEP 6 🖐️ Firebase secret 移出 URL（M1）
`gas/sheets.gs:51,69` 的 `?auth=<secret>`：
- 改用 Firebase OAuth/Admin token 走 Authorization header；或若維持 legacy secret，確認 RTDB 規則 default-deny（`.read`/`.write` 預設 false）、secret 存 `PropertiesService`（現況已是）、錯誤處理不回吐含 secret 的 URL。
- 🖐️ RTDB 安全規則不在 repo，須到 Firebase console 檢視並設 default-deny。

---

## B 軌（等脊椎 A，僅列不做）
- **C1 前端授權**：現行 `can()` 是 UX 層，`setRole('admin')` 可繞。根治＝後端跑同一張 `AUTH_MATRIX`，前端降為提示（AUTH_MATRIX_SPEC §10）。
- **H3 PII 加密**：真後端就緒前，前端/Sheets 只放合成假資料或遮蔽形＋參照 ID，別讓真實 S2/S3 個資落地明文。
- **M3 無認證/速率限制**：後端範疇。

---

## 未來開 public 前必清（C 軌）
DRMS 要能安全開 public，切開關前逐項清：
- [ ] C1 已由後端接管，或 public 版是**零真實資料的展示殼**（否則 `setRole('admin')` 人人可用）
- [ ] 硬編 GAS `/exec`（H2）已移到後端 proxy/環境變數
- [ ] `SECURITY_REVIEW_0706.md` + 本 runbook（含 file:line 漏洞地圖）**從 public 版移除或漏洞已全補**
- [ ] `.bak` 檔（`arch-script.js.bak`、`arch-style.css.bak`）移除
- [ ] 示範 PII（`app.js:3582-3590` 等）確認全為合成
- [ ] 🖐️ 跑一次 git **history** secret scan（gitleaks/trufflehog），確認歷史從未誤 commit 真實憑證

---

## 部署注意
本 runbook 在 branch `claude/repo-security-review-peryld`。**不執行 TC-drms CLAUDE.md 的 auto-merge-to-main**——安全內容需 Mason 過目再併。

## 完成判準（A 軌）
- [ ] GAS `CHANNEL_SECRET`/共享密鑰未設時 webhook 回 401（fail-closed），無 `return true`
- [ ] LINE webhook 驗簽在能讀 header 的 Worker 完成
- [ ] GAS Web App 存取權非「任何人」
- [ ] intake 無等同密碼的前端常數
- [ ] XSS helper 覆蓋所有 DOM 插入點，Playwright 四寬度通過
- [ ] Firebase 不再以 query 傳 secret，RTDB 規則 default-deny
