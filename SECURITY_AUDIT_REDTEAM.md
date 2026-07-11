# 紅隊資安盤點報告（DRMS 儀表板）

> 對應開發待辦 P1「紅隊演練：盤點儀表板資安漏洞」。
> 盤點日：2026-07-11。範圍：app.js（單檔前端）、index.html、gas/*.gs。
> 方法：靜態程式碼審計，逐一檢視 6 個攻擊面，全部附 file:line 實證。

## 架構前提（決定「哪些能真修」）

DRMS 為**單檔前端**：所有邏輯與資料在瀏覽器端，`role` 權限判斷是前端全域變數，
資料存 `localStorage` 與 Google Sheets。因此凡屬「防前端竄改」「防提權」「防個資落地」
的問題，**前端無法真正修復**，唯一真修是後端存取層 + session/role 二次驗證（即 P1 個資加密後端）。
本次能就地修的，只有「渲染端 XSS 跳脫」與「輸入端淨化」這類前端防線。

---

## A. 前端已修（本次 commit）

| # | 攻擊面 | 檔:行 | 問題 | 修法 |
|---|---|---|---|---|
| V2-1 | 儲存型 XSS | app.js 任務池（catList／看板／清單） | `t.title`/`t.category`/`aname`/`asgName`/`t.priority` 直插 innerHTML | 渲染值包 `esc()` |
| V2-2 | 儲存型 XSS | app.js 報名暫存名單 render + `addSignup` | `r.name`/`r.group`/`r.phone` 未跳脫；phone 輸入端未淨化 | render 包 `esc()`；phone 加 `sanitizeInput()` |
| V2-3 | 儲存型 XSS | app.js 志工名冊 / 報到表 / 重建個案表（10 處 maskPII 及 c.name/psychDisp） | `maskPII()` 於 admin 檢視時回傳原值且從不跳脫，直插 innerHTML | 所有 maskPII 輸出與 c.name/psychDisp 渲染端包 `esc()` |
| V2-4 | 反射型 XSS | app.js `requestBreakGlass` | 破窗 `reason`（來自 `prompt()`）直插 innerHTML | `esc(reason)`、`esc(requesterLabel)` |
| V2-5 | 資料植入 | app.js `importBackupFile` | 匯入備份僅檢查 `snap.data` 存在，可植入任意資料（含 XSS payload） | 加結構白名單校驗：data 須為物件且至少含 3 個 `DATA_KEYS` |

**補強原則：** `sanitizeInput()`（app.js 輸入端）偏弱，且外部來源資料（Firebase / GAS / 匯入 JSON）
根本不經輸入端。真正防線是**所有 innerHTML 渲染端統一 esc()**——本次已補上被盤點到的高風險 sink。
後續新增 render 點務必沿用此原則。

---

## B. 需後端／基礎設施才能真修（本次僅記錄，不可就地修）

| # | 攻擊面 | 檔:行 | 架構限制 | 對應待辦 |
|---|---|---|---|---|
| V1-1 | 權限繞過（Critical） | app.js `role` 全域變數、`setRole` | console 一行 `role='admin'` 即提權；前端變數本質不可信 | P1 後端驗證 |
| V1-2 | 權限繞過（Critical） | app.js `pageAccessLevel`（admin→P0） | 所有頁面 gate 只讀 `role`，改變數即穿透 | P1 後端驗證 |
| V1-3 | 授權（High） | gas webhook.gs `handleBridge` / handlers.gs | GAS 動作只驗 BRIDGE_KEY，`uid` 由呼叫端自填，不驗角色/身分 | P1 後端驗證 |
| V3-1 | 竄改（High） | app.js `drms_data`/`drms_rtdb`/`drms_config` | PII、稽核 log、簽到、橋接金鑰明文存 localStorage，可 console 竄改 | P1 後端存取層 |
| V4-1 | 金鑰（Critical） | app.js `drms_config`、webhook.gs 比對 | BRIDGE_KEY 單一共用靜態密鑰＋明文存瀏覽器；無 per-user、無輪替、無角色綁定 | P1 + 基礎設施 |
| V4-2 | 端點曝露（Medium） | app.js `REG_API_URL` 硬編碼 | 完整 /exec 部署 URL 進版控；**改後台設定注入屬行為變更、且已洩露端點需重新部署換 ID**，故留待決策 | 基礎設施（見下） |
| V4-3 | 無 CORS/限流 | app.js（text/plain 規避預檢）、webhook.gs | GAS Web App 讀不到 header，僅能記錄，無法真正限流 | 架構限制 |
| V5-1 | 報到偽造（High） | app.js `gasCheckIn`/QR、handlers.gs 報到 | 掃碼報到只憑已知 email/編號，不驗本人；可代人報到、灌假點名/SOS | P1 一次性 token 綁 LINE userId |
| V6-1 | 個資曝露（High） | app.js `maskPII`/`canViewFullPII` | 遮蔽僅視覺層，`DATA.registry.volunteers` 原值 console 可全讀 | P1 欄位級加密 + 後端存取層 |

### 需基礎設施處置（提報 Mason 決策）

1. **`REG_API_URL` 已進版控**（app.js 硬編碼）：該 GAS 部署 ID 已公開，建議**重新部署換新 /exec URL**
   並改由後台設定（`DATA.registry.gasUrl`）注入，而非硬編碼。本次未改碼以免中斷現行報名流程。
2. **BRIDGE_KEY 輪替**：配合上項一併輪替，並規劃 per-user token 取代單一共用金鑰。

---

## 結論

- **前端可修範圍已全數修畢**（V2-1～V2-5，XSS/資料植入防線）。
- **B 群 9 項均為架構限制**，指向同一根因：前端不可信 + 個資落地。真修 = 開發待辦 P1
  （個資加密後端 + role 二次驗證），非前端 patch 能解。
- 建議 P1 落地前，儀表板**不承載真實個資**，或僅在受控內網/單機使用。
