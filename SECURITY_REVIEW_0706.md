# TC-DRMS 安全審查 + 無漏洞架構設計

> 撰於 2026-07-06。全 repo 唯讀掃描 → findings → 對齊既有 `AUTH_MATRIX_SPEC`／`SECURITY_APPROVAL`／`FABLE_HANDOFF` 脊椎 A/B/C → 補上尚未設計的無漏洞架構。
> 分級：Critical/High/Medium/Low。每條標「已追蹤」（既有 spec 已涵蓋）或「新」（未進雷達，需處理）。

---

## 0. 一句話結論

TC-DRMS 的授權設計（脊椎 B）**觀念正確且已落地前端** `can()`，但**整個系統目前沒有後端信任邊界**——瀏覽器端的一切（角色、`can()`、PII 遮蔽）都可被 console 繞過。這在 spec 裡是已知的「脊椎 A 未上線」。真正需要現在動手的，是**兩個後端接觸點的具體漏洞**（GAS webhook 失效、硬編部署 URL）與**前端輸入轉義的零星破口**——這些不必等脊椎 A，現在就能修，且修了不會白工（後端上線後仍有效）。

---

## 1. Findings 對齊表

| # | 嚴重度 | 漏洞 | 位置 | 狀態 |
|---|---|---|---|---|
| C1 | Critical | 授權完全在前端，`setRole('admin')` 可從 console 自升管理員 | `index_v4.0_20260622.html:6537,4091,5489,5503,6421` | **已追蹤**（AUTH_MATRIX_SPEC §1、§10「前端矩陣屆時降級為 UX 提示」；脊椎 A 未上線）|
| H1 | High | LINE webhook 簽章驗證**失效兩重**：secret 未設 → `return true`（fail-open）；且從 `e.parameter` 讀簽章（GAS doPost 讀不到 HTTP header） | `gas/webhook.gs:11,37-40` | **新** |
| H2 | High | 硬編碼 GAS 部署 URL（真實志工報名端點）於前端 | `app.js:3744`、`index_v4.0_20260622.html:4640` | 半追蹤（`arch-script.js:372/415` 開發者自註待改，未列安全風險）|
| H3 | High | PII 明文存 localStorage 與 Sheets，僅前端遮蔽未加密 | `app.js:3582-3590`、`gas/sheets.gs` | **已追蹤**（HEALTH `case: 個資未加密P1待修`）|
| H4 | High | intake 管理密碼前端明文比對（目前 placeholder） | `intake.html:83,232` | **新** |
| M1 | Medium | Firebase secret 以 `?auth=` query 附 URL（易入日誌）；規則開放且未設 secret 即無認證寫入 | `gas/sheets.gs:51,69` | **新** |
| M2 | Medium | XSS 轉義不一致：`m.title` 屬性注入、`cat.name` 未轉義；`drms_v4.html` 43 處 innerHTML 無 esc helper | `app.js:4138,1332`、`drms_v4.html` | **新**（主要輸入路徑 LINE/intake 已有 escHtml，安全）|
| M3 | Medium | Sheet/Firebase 當後端且無認證層/速率限制，doPost 無防重放防洪 | `gas/*.gs` | **已追蹤**（脊椎 A 範疇）|
| L1-3 | Low | 進版控的示範 PII（合成）、`.bak` 檔進版控、示範假電話 | 見掃描 | 可清但非漏洞 |

---

## 2. 無漏洞架構：分三層，各有「現在就能做」與「等脊椎 A」

### 2.1 信任邊界原則（貫穿全系統的那條線）

> **凡是使用者的瀏覽器能改的，都不是安全邊界，只是 UX。**

現況所有守門都在瀏覽器內，等於沒有邊界。無漏洞架構只有一種形狀：**每一個會改資料或讀 PII 的動作，都必須在一個使用者改不到的地方（伺服器）再驗一次 `can()`。** 這正是 AUTH_MATRIX_SPEC §10 講的「同一張矩陣搬到伺服器再驗」。設計要點：

```
瀏覽器 can()  →  只決定「畫面顯不顯示、按鈕給不給按」（UX，可被繞過，無妨）
伺服器 can()  →  真守門。每個 write/敏感 read 進來都重跑，矩陣是同一份資料
```

**關鍵設計決定：矩陣資料（`AUTH_MATRIX` 常數＋戰時 delta）必須做成「後端下發、前端快取」**，不是前端各存一份。否則前後端會像現在 `PERMS_PEACE`/`PERMS_WAR` 一樣各自演化（F2 的病根）。單一真相在後端，前端拿到的是唯讀副本。

脊椎 A 上線前，這層無法真正存在——所以 C1/H3/M3 在後端就緒前**無法根治**，只能靠「不把真實 PII 放進這個前端」來降險（見 2.4）。

### 2.2 GAS 後端接觸點——現在就能做到無漏洞（H1/M1）

這是唯一已經有後端（Apps Script）的部分，兩個漏洞現在就能修，且是 fail-closed 設計：

**H1 webhook 簽章——改成「驗不了就拒收」而非「驗不了就放行」：**

```
現況（漏洞）：
  function verifySignature(body, sig){
    if(!CHANNEL_SECRET) return true;        // ← fail-open：沒設 secret 全放行
    ...從 e.parameter 取 sig...             // ← GAS doPost 讀不到 header，正式情境也不可靠
  }

無漏洞設計：
  1. 啟動守衛：CHANNEL_SECRET 未設 → doPost 直接 return 401 並 logSys('CONFIG_ERROR')，
     絕不 return true。「設定缺失」必須 fail-closed。
  2. 簽章來源：LINE 的 X-Line-Signature 是 HTTP header，GAS Web App 的 doPost(e) 拿不到 header。
     → 這代表「用 GAS 直接當 LINE webhook」在架構上就無法安全驗簽。
     兩條無漏洞路線（擇一）：
       (a) 前置一層能讀 header 的 proxy（Cloudflare Worker / Cloud Functions）驗簽後才轉發 GAS；
       (b) 放棄 GAS 當 webhook，webhook 收在 Worker，GAS 僅作 Sheets 寫入的內部 API 且加共享密鑰。
     建議 (a)：改動最小，且與 disaster-response-center 已在用的 Cloudflare 生態一致。
  3. 驗簽用 HMAC-SHA256 + Utilities.computeHmacSha256Signature，**constant-time 比較**，
     且比對前先確認 body 原文未被 GAS 重新序列化（用 e.postData.contents 原始字串）。
```

**M1 Firebase secret——移出 URL query：**
```
現況：https://…firebaseio.com/…json?auth=<secret>   // secret 進了 GAS 執行日誌與可能的錯誤堆疊
無漏洞：改用 Firebase Admin/OAuth token 走 Authorization header；
        或若維持 legacy secret，至少確認 RTDB rules 為 default-deny（.read/.write 預設 false），
        secret 存 PropertiesService（現況已是，良好），且錯誤處理不回吐含 secret 的 URL。
        RTDB rules 不在 repo → 必須另外檢視（見 §4 待確認）。
```

### 2.3 前端輸入轉義——現在就能做到無漏洞（H4/M2）

**H4 intake 管理密碼：** 前端明文比對在任何情境都不是認證，只是「防手滑」。無漏洞設計：把管理動作的授權移到 2.2 的 GAS 端（帶共享密鑰的內部 API），前端只留「防誤觸」的確認框，**不放任何等同密碼的常數**。在脊椎 A 前，至少把 `ADMIN_PASSCODE` 常數移除，管理功能改為「需在 URL 帶一次性 token 或走 GAS 驗證」。

**M2 XSS：** 統一一個 `escHtml()` helper，**所有**把資料插進 DOM 的點都過它，特別是：
- 屬性注入：`value="${m.title}"` → `value="${escAttr(m.title)}"`（屬性用的跳脫要含 `"` `'`）。
- `drms_v4.html` 43 處裸 innerHTML → 逐一改用 textContent 或過 escHtml。
- code review 規則：新增任何 `innerHTML =` 一律要過 helper，否則擋 PR。

### 2.4 脊椎 A 前的減損（C1/H3 無法根治時的架構性降險）

後端沒就緒前，C1/H3 的唯一有效防線是**不讓真實高敏個資進入這個可被繞過的前端**：
- 身分證、生日、完整電話、地址等 S3/S2 級欄位（AUTH_MATRIX §4.4），在後端就緒前**不落地到 localStorage / Sheets 明文**。需要時只存「遮蔽形＋後端可還原的參照 ID」。
- 現況 app.js 內是合成假資料——維持這條線：**demo/前端環境永遠只餵假資料**，真實 PII 只在有後端守門後才進系統。這把 C1 從「災難」降為「假資料被看光，無實害」。

---

## 3. 建議執行順序（風險/成本比）

| 序 | 項目 | 為何優先 | 動誰 | 阻擋條件 |
|---|---|---|---|---|
| 1 | H1 webhook fail-closed + M1 secret 移出 URL | 唯一「有後端、現在就能無漏洞」的接觸點；fail-open 是即時可被偽造寫入 | `gas/webhook.gs`、`sheets.gs` | **需先確認正式環境 CHANNEL_SECRET 已設**，否則改成 fail-closed 會擋掉真流量 |
| 2 | M2 統一 escHtml + H4 移除明文 passcode | 純前端、可獨立驗證、不依賴後端 | `app.js`、`drms_v4.html`、`intake.html` | 無 |
| 3 | H2 GAS URL 治理 | 端點外露，需搭配 2.2 的 proxy 一起做 | `app.js`、html | 依賴 §2.2 proxy 決策 |
| 4 | C1/H3/M3 根治 | 需脊椎 A 後端 | 新後端 | 脊椎 A 立項（大工程，工作坊層級決策）|
| — | 2.4 減損（前端只餵假資料） | 脊椎 A 前的護欄 | 流程紀律 | 無 |

---

## 4. 需 Mason／repo 外確認（無法從版控判定）

1. **GAS `/exec` 部署權限**＝「任何人」還是「僅本人」？決定 H2 是否已是無認證 PII 入口。
2. **正式環境是否已設 `CHANNEL_SECRET` / `FIREBASE_SECRET`**？決定 H1/M1 是否「現在就可被利用」，也決定序 1 能否安全改 fail-closed。
3. **Firebase RTDB 安全規則**（不在 repo）是否 default-deny？
4. **intake.html 部署版的 `ADMIN_PASSCODE`** 是否已被換成真值？若是則 H4 升為即時洩密。

---

## 5. 與既有 spec 的關係（不重造輪子）

- 本文件**不新增授權模型**——`can()` 單一守門、統一角色映射、破窗、SoD 全部沿用 `AUTH_MATRIX_SPEC`。
- 本文件補的是 spec 未展開的三塊：**① 信任邊界的前後端分工具體形狀（§2.1）、② GAS 接觸點的 fail-closed 設計（§2.2）、③ 脊椎 A 前的減損護欄（§2.4）**。
- `SECURITY_APPROVAL.md` 是對外/對組織的政策文件；本文件是對內的技術實作審查，兩者互補。

---

## 附：部署注意

本審查在 branch `claude/repo-security-review-peryld`。**未執行 TC-drms CLAUDE.md 的 auto-merge-to-main 規則**——安全審查內容應經 Mason 過目再決定是否併入 main，不自動合併。
