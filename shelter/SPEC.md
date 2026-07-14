# 安身 AnShen — 慈濟大型災害收容安置管理系統｜完整技術規格書

> **文件用途**：本文件是可直接交給 AI（Claude／GPT／其他程式生成模型）的參考規格。AI 應能僅憑本文件重建整個系統，無需其他資料。
> **交付形式**：單一 HTML 檔（vanilla JS、零外部依賴、可離線），約 1,640 行。
> **狀態**：已實作並通過驗收（Playwright 50/50、fresh-context verifier「可上」），線上演示 https://wrvulcan-rgb.github.io/TC-drms/shelter/
> **重要**：所有人物、據點、數據皆為虛構演示情境（2026 山腳斷層地震），不含真實個資。

---

## 0. 給 AI 的重建指示

1. **輸出單一 `index.html`**：所有 CSS 在 `<head><style>`、所有 JS 在 `<body>` 末端單一 `<script>`。禁外部 CDN／字型／圖檔（目標環境有嚴格 CSP，外連一律封鎖）。圖示用 Unicode 字元或 emoji，不用圖檔。
2. **架構鐵律**：單一狀態物件 `S` 為唯一資料源；所有變動經 reducer 函式，改完後呼叫一次 `commit()`（存檔＋重繪）。`render` 只重繪當前分頁容器，不整頁重繪（避免表單失焦、重複渲染）。
3. **禁用框架**：不用 React／Vue／任何建置工具。純 DOM 字串拼接 + `innerHTML`。
4. **語言**：全站正體中文（繁體），禁簡體字。使用慈濟專有語彙（見 §11）。
5. **持久化**：`localStorage` 存整個 `S`，含 schema 版本鍵；版本不符則重置為種子資料。
6. **雙主題**：亮／暗色，透過 CSS custom properties + `prefers-color-scheme` + `data-theme` 屬性覆蓋。
7. **RWD**：375 / 390 / 768 / 1440 四寬度皆須 console 零錯誤、無水平捲動、導覽可用。≥1024px 顯示側欄，<1024px 改頂部頁籤列。

---

## 1. 系統概述

### 1.1 一句話定義
當慈濟會所（靜思堂／志業園區／聯絡處）被啟用為大型災害收容安置處所時，把**收容個案管理**（既有強項）×**分會空間管理**（總務處平時零能量）×**餐食物資設備供應**（零整合經驗）三者整合為一套含**工作流、資訊流、權限流**的營運系統。

### 1.2 背景痛點（系統要解決的真實課題）
| 現況缺口 | 系統對應解法 |
|---|---|
| 靜思堂空間管理的總務處，完全沒有「會所變大型收容所」的能量準備 | 「平時整備檢核表」＋空間平時建檔——把能量建在平時，開設申請時檢核表即為佐證 |
| 個案管理有一定基礎（社區慈善＋災害關懷經驗可延伸） | 個案關懷模組沿用既有訪視語彙：安心膚慰／醫療（人醫會）／物資協助／轉介／退住轉社區訪視 |
| 空間×餐食×物資的**整合**經驗完全是 0 | 單一資料源：一次報到，六處自動連動（空間／餐食／物資／警示／儀表板／稽核），杜絕「第二份真相」 |

### 1.3 命名理念（貫穿系統敘事）
- **安身**＝空間與床位（據點空間管理、福慧床毛毯配發）：先讓災民有安穩落腳處。
- **安心**＝關懷與膚慰（個案關懷、人醫會醫療、香積熱食）：訪視志工的傾聽陪伴。
- **安生**＝生活重建（退住評估、轉社區訪視追蹤）：收容結束，關懷不斷線。

### 1.4 目標使用者
現場 8 種功能角色（見 §5），從本會防災協調中心到社區協力志工。使用者多為志工（動機驅動，非合規驅動），介面須低學習成本、防呆優先於報錯。

---

## 2. 技術架構與約束

### 2.1 檔案結構
```
單一 index.html
├── <head>
│   ├── <meta viewport>
│   ├── <link rel="icon"> data-URI SVG（⛺ emoji）
│   └── <style> 全部 CSS（設計 tokens + 元件 + RWD）
└── <body>
    ├── .app（.sidebar + .main）
    ├── #modalRoot（Modal 掛載點）
    ├── #toasts（Toast 掛載點）
    └── <script> 全部 JS
        ├── 常數與工具（$、esc、pad、nowStr）
        ├── TABS / ROLES / PERM（角色權限定義）
        ├── ITEMS / DIETS / NEEDS / *_STATUS（列舉）
        ├── seed()（種子資料工廠）
        ├── S = load() / save() / commit()（store）
        ├── 衍生查詢（siteOf, hhIn, occSpace, stockOf...）
        ├── audit() / guard() / can()（權限流執行點）
        ├── Reducers（registerHousehold, dischargeHousehold, approveOpen...）
        ├── toast() / openModal() / closeModal()
        ├── Views（vDash, vSites, vIntake, vCare, vMeals, vSupplies, vStaff, vAbout）
        ├── renderShellBits() / renderView() / switchTab()
        └── boot()（IIFE 啟動）
```

### 2.2 狀態管理模式（核心，務必照做）
```
單一 S 物件（唯一資料源）
   │  變動一律經 reducer 函式
   ▼
reducer：前置檢查全過 → 一次改完所有相關欄位 → return 結果
   │
   ▼
呼叫端：commit()  ← save()（寫 localStorage）＋ renderShellBits()（殼層徽章）＋ renderView()（當前分頁）
```
- **禁止**：把一次業務動作拆成多次 setState / 多次 commit（會產生「改了空間、漏了餐食」的部分更新＝第二份真相）。
- `renderView()` 只重繪 `#view`（當前分頁）；`renderShellBits()` 只重繪側欄／頂列／事件列（含徽章數字）。兩者分離。
- UI 暫存（表單草稿、當前子分頁）放獨立 `UI` 物件，**不入 `S`、不進 localStorage**（避免未提交的孤兒資料）。

### 2.3 持久化與版本
```js
const VER = 'anshen-v1';
function load(){
  try{ const raw = localStorage.getItem('anshen');
    if(raw){ const d = JSON.parse(raw); if(d && d.version === VER) return d; } // 版本符才用
  }catch(e){}   // 私隱模式 / JSON 壞 → 落種子
  return seed();
}
function save(){ try{ localStorage.setItem('anshen', JSON.stringify(S)); }catch(e){} }
```
- schema 改版時 bump `VER`，舊資料自動作廢重置，杜絕結構殘留。

### 2.4 為何不用框架
YAGNI：狀態小、變動點明確、需離線單檔部署、目標環境禁外連。框架的 diff／建置成本在此場景無收益，純 DOM 拼接反而最小可控。

---

## 3. 設計系統

### 3.1 配色理念
慈濟藍為主色（沉穩、信任、非營利莊重感），暖木色（`--wood`）作為文化語彙點綴（安身安心安生、慈濟語彙標題）。語意色（good/warn/crit）與品牌色分離，不拿語意色當第 4 個類別色。

### 3.2 完整 CSS Tokens（亮色 `:root`）
```css
--navy:#1E4066; --navy-deep:#16334F; --on-navy:#F4F7FB; --wood:#8A6B45;
--bg:#F2F4F7; --surface:#FFFFFF; --surface2:#E9EDF3; --surface3:#DFE5EE;
--ink:#1C2736; --ink2:#4E5E74; --ink3:#7C8AA0; --border:#D8DFE9; --border2:#C4CEDC;
--ok:#2E7D4F; --ok-bg:#E3F1E9; --warn:#B45309; --warn-bg:#F7ECDC;
--crit:#B3372B; --crit-bg:#F8E7E4; --info-bg:#E6EDF6;
--c1:#3A6FB0; --c2:#C07A2E; --c3:#3E8E5C; --c4:#9061C2;   /* 類別色（圖表/分區），通過色盲檢驗 */
--serif:"Noto Serif TC","Songti TC","PMingLiU",serif;
--sans:"PingFang TC","Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif;
```
### 3.3 暗色 Tokens（`@media (prefers-color-scheme: dark)` 與 `:root[data-theme="dark"]` 各定義一次）
```css
--navy:#2E5A8F; --navy-deep:#254a77; --on-navy:#EAF1F9; --wood:#C9A87A;
--bg:#0F1621; --surface:#182231; --surface2:#1F2C3F; --surface3:#26354B;
--ink:#E9EEF5; --ink2:#A6B4C8; --ink3:#71809A; --border:#2A3A52;
--ok:#5BBF8A; --ok-bg:#1B3327; --warn:#E8A33D; --warn-bg:#3A2C14;
--crit:#E36B5C; --crit-bg:#3B1F1B; --info-bg:#1D2E44;
--c1:#5C8FC7; --c2:#CE7F2B; --c3:#55A377; --c4:#A97FD1;
```
- **主題切換邏輯**：`S.theme` 值為 `null`（跟隨系統）→ `'light'` → `'dark'` 循環；`null` 時移除 `data-theme` 屬性，其餘 setAttribute。`prefers-color-scheme` 媒體查詢與 `data-theme` 皆須定義同一組 token（data-theme 優先權較高，覆蓋媒體查詢）。
- 類別色 c1–c4 已經 dataviz 色盲驗證器檢過（亮/暗兩組皆通過亮度帶、彩度地板、CVD 分離、對比四項）。

### 3.4 字體角色
- **serif（Noto Serif TC）**：品牌字「安身」、頁面主標題 h1、Modal 標題、命名理念標題。用於情感／莊重處。
- **sans（PingFang/Noto Sans TC）**：所有內文、表格、按鈕、標籤。
- 數字欄位一律 `font-variant-numeric: tabular-nums`（對齊）。

### 3.5 元件庫（class 名稱與用途，AI 須全部實作）
| class | 用途 | 關鍵樣式 |
|---|---|---|
| `.card` | 內容卡片 | surface 底、border、圓角 10px、陰影 |
| `.stat` | 統計數字（k 標籤 / v 大數字 / d 說明） | v 為 27px 700 tabular-nums |
| `.chip` + `.ok/.warn/.crit/.info/.mut/.wood` | 狀態膠囊 | 圓角 99px、對應語意底色 |
| `.dot` + `.ok/.warn/.crit/.mut` | 8px 圓點狀態燈 | |
| `.btn` + `.pri/.sec/.ok/.crit-o` + `.sm` + `.locked` | 按鈕 | `.locked` 附 🔒 且半透明（無權限） |
| `.signal` | 燈號警示列項目 | 左 4px 語意色邊條 + 大數字 |
| `.alert-strip` | 橫向可捲警示列 | |
| `.meter` + `.meter i` + `.warn/.crit` | 容量/庫存量表條 | 依百分比著色，≥75% warn、≥90% crit |
| `.meter-row` | 量表列（lab + meter + val） | |
| `.tbl-wrap` + `table` | 可橫捲表格 | th 為 12px ink3、tabular-nums |
| `.steps` + `.step` + `.on/.done` | 流程步驟條 | done 顯 ✓、on 顯 navy 圓標 |
| `.item` / `.item-list` | 清單卡 | row1 + meta + acts |
| `.tl` + `.tl li` | 時間線（稽核/連動紀錄） | 左側連續線 + 圓點 |
| `.bubble` + `.up/.down/.alert` | 連動摘要氣泡（money shot） | scale pop 動畫、依方向著色 |
| `.ripple-house` / `.ripple-grid` | 連動摘要面板容器 | 3 欄氣泡格 |
| `.matrix` | 權限矩陣表 | y 格綠、p 格橙、n 格灰 |
| `.check-list` | 整備檢核清單 | done 項打勾綠底方框 |
| `.flow-box` / `.flow-line` / `.fnode` / `.farr` | 制度說明的靜態流程圖 | fnode.hot 藍、.okn 綠 |
| `.subtabs` | 頁內子分頁 | 底線 active |
| `.role-pill` + `select` | 角色切換器 | |
| `.zone-tag` | 分區標籤 | |
| `.modal-bg` / `.modal` | 對話框 | 半透明遮罩 + blur |
| `.toast` + `.ok/.crit` | 浮動提示 | 3.6s 後淡出 |
| `.empty` | 空狀態虛線框 | |
| `.foot` | 頁尾聲明 | |
- 無障礙：`:focus-visible` 給可見 focus ring（`--focus`）；`prefers-reduced-motion` 關閉動畫；Modal 用 `role="dialog" aria-modal="true"`；`#toasts` 用 `aria-live="assertive"`；`#view` 用 `aria-live="polite"`。

### 3.6 RWD 斷點
- `≥1024px`：`.app` 為 `grid-template-columns:236px 1fr`，顯示 `.sidebar`，隱藏 `.topbar`。
- `<1024px`：單欄，隱藏側欄，顯示 `.topbar`（品牌 + 角色切換 + 橫捲頁籤 `.tab-rail`），`.g2/.g3/.g4` 降為 2 欄，`.ripple-grid` 降 2 欄。
- `<520px`：`.g3/.g4` 維持 2 欄、`.g2` 降 1 欄、`.frow` 表單降 2 欄。

---

## 4. 資料模型（完整 Schema + 種子）

> 所有種子資料為虛構「2026-07-12 山腳斷層 M6.8 地震」情境。以下逐 entity 列欄位、型別、種子範例。`S` 頂層另有：`version, role('hq'), site('banqiao'), tab('dash'), theme(null), seq(100)`。`seq` 為流水號起點，產生新 ID 時 `++seq`。

### 4.1 event（單一事件物件）
```
{ name:'0712 山腳斷層地震', mag:'M6.8', level:'中央二級開設',
  started:'07/12 06:47',
  desc:'新北板橋、三重、北投多處建物受損，市府請求慈濟開設收容處所' }
```

### 4.2 sites[]（據點，4 筆）— 據點開設狀態機的載體
欄位：`id, name, short, status, cmdr(指揮), volunteers, addr` + 選填 `openedAt/applyAt/applyNote`。
`status` 列舉見 §6.1。
```
banqiao  板橋靜思堂    open      指揮 陳志明  志工86  07/12 09:30 開設
sanchong 三重志業園區  open      指揮 林秀蘭  志工42  07/12 11:05 開設
guandu   關渡志業園區  applying  指揮 張文華  志工12  07/13 07:50 申請（社會局來函請求 150 床）← 演示核准流用
songshan 松山聯絡處    standby   指揮 吳靜宜  志工0            ← 演示「平時整備」概念用
```

### 4.3 spaces[]（收容空間/分區，17 筆）
欄位：`id, siteId, name, floor, zone, cap`（`cap:null`＝服務空間不收容）。
分區類型（zone）：家庭區／長者友善區／單身女性區／單身男性區／母嬰區／隔離觀察／彈性分區／服務空間。
板橋 10 個空間範例：
```
sp1 講經堂 1F 家庭區 cap96 | sp2 感恩堂 2F 長者友善區 cap40 | sp3 教室301 3F 單身女性區 cap24
sp4 教室302 3F 單身男性區 cap24 | sp5 母嬰室 2F 母嬰區 cap8 | sp6 隔離觀察室 3F 隔離觀察 cap6
sp7 醫護站(人醫會) 1F cap null | sp8 齋堂(香積供餐) 1F cap null | sp9 地下停車場(物資儲運) B1 cap null
```
三重 4 個（sp10 大講堂 cap60…）、關渡 2 個（sp14 國際會議廳 cap120、sp15 教室群 cap60）、松山 2 個（sp16 佛堂 cap40、sp17 教室101 cap20）。

### 4.4 households[]（收容戶，10 筆）— 收容以「戶」為單位
欄位：`id, siteId, spaceId, head(戶長), idm(證號遮罩), phone, addr, checkin, status('in'|'out'), members[], reserved{}` + 退住後 `checkout, followUp(bool), followNote`。
`members[]` 每筆：`{ name, age, sex, diet, needs[] }`。
`reserved{}`：報到時保留的物資 `{ bed, blanket, kit }`（數量＝戶口數）。
種子重點戶（演示會用到）：
```
H001 林建宏戶 5口 → sp1家庭區（含 林張玉蘭68歲軟食慢性病）
H003 王金龍戶 2口 → sp2長者友善（王金龍72慢性病+行動不便、李阿香70糖尿病餐）← 演示退住轉追蹤用
H005 張淑芬戶 2口 → sp5母嬰（張安安1歲嬰兒副食）
H010 高進財戶 2口 status:'out' 已退住 → followUp:true（示範已退住可查+社區追蹤名單）
```
- 種子在住 8 戶共 16 人於板橋（演示報到後 +5＝21，退住 H003 後 19）。

### 4.5 stock[]（庫存，20 筆）
欄位：`{ siteId, itemId, qty, safety(安全庫存) }`。
狀態判定 `stockCls(r)`：`qty <= floor(safety/2) || qty===0` → `crit`；`qty < safety` → `warn`；否則 `ok`。
板橋種子（演示報到 −5 會觸發毛毯警示）：
```
bed 30/20 | blanket 18/15 ← 報到5口後13<15觸發warn | kit 34/10 | rice 12/8
water 22/10 | diaper 4/5(已warn) | fem 9/6 | mask 15/10 | gen 2/1 | light 4/2
```

### 4.6 ITEMS（物資品項目錄，10 種，常數非種子）
欄位：`id, name, unit, perPerson?(每人配額), returnable?(可回收), equip?(設備)`。
```
bed 福慧床 張 perPerson返回 | blanket 環保毛毯 件 perPerson返回 | kit 盥洗包 份 perPerson消耗
rice 淨斯香積飯 箱 | water 瓶裝飲用水 箱 | diaper 嬰幼兒尿布 包 | fem 女性衛生用品 包
mask 醫療口罩 盒 | gen 行動發電機 台 equip | light LED照明燈組 組 equip
```

### 4.7 reqs[]（物資請領單，3 筆種子）
欄位：`id, siteId, itemId, qty, cross(bool跨據點), from?(來源據點), reason, by(角色), byName, at, status, apprBy?, log[]`。
`status` 列舉見 §6.3。`log[]` 每筆 `{t, s}`（時間、事件）。
種子：`R-1042`(pending 板橋香積飯20)、`R-1041`(approved 跨據點毛毯50)、`R-1039`(received 三重水10)。
> **演示關鍵**：報到時毛毯掉到 13，需建 R-1042 走完整鏈；跨據點單只有總指揮能核准。

### 4.8 donations[]（捐贈，2 筆）
`{ id, siteId, donor, itemId, qty, at, status('pending'|'received'), note?, recvBy? }`。

### 4.9 careLogs[]（關懷紀錄，6 筆）
`{ id, hhId, type, note, by(志工姓名，必填), at, followUp(bool) }`。
`type` 列舉：`安心關懷 / 醫療 / 物資協助 / 轉介`。
> **文化約束**：每筆必含 `by`（志工姓名）——膚慰是人對人的工作，紀錄必留人的名字。

### 4.10 meals（香積餐食，物件 by siteId）
每站 3 餐 `[{k('b'|'l'|'d'), name, time, forecast?, planned?, produced?, served?, done(bool)}]`。
種子板橋早/午已 done，晚餐待排。開設新據點時自動建立空三餐排程。

### 4.11 checklists（平時整備檢核表，物件 by siteId）
每項 `{ t(項目), done(bool) }`。僅 `songshan`(6/8) 與 `guandu`(8/8) 有——演示「平時整備」。8 項：空間平面圖／消防安檢／發電機月測試／福慧床毛毯盤點／飲水設備／香積廚房設備／無障礙動線／志工聯絡網演練。

### 4.12 staff（志工人力，物件 by siteId，唯讀展示）
每組 `{ g(組名), e/a(早班需/實), l/la(午班), n/na(晚班) }`。降級為唯讀（寫死數字、無編輯）。

### 4.13 audit[]（稽核軌跡，9 筆種子）— 權限流的記錄
`{ at, role, action, detail, ref?(關聯ID), siteId? }`。
`action` 值：事件／開設／核准／報到／退住／請領／出庫／簽收／駁回／捐贈入庫／香積／整備／關懷／警示／**越權攔截**。
> 每個業務動作與每次越權都寫一筆。`ref` 關聯戶號/單號，用於「連動紀錄」回查（`showLinkage` 依 `ref===hhId` 篩選）。

---

## 5. 角色與權限系統（權限流）

### 5.1 八角色定義（ROLES）
每角色：`name, org(對應慈濟編制), home(登入預設分頁), tabs[](可見分頁)`。
| key | name | org（慈濟編制） | home | 可見分頁 |
|---|---|---|---|---|
| hq | 總指揮中心 | 本會防災協調中心 | dash | 全部 8 |
| cmd | 據點指揮 | 園區／分會（合心・和氣） | dash | 全部 8 |
| reg | 報到組 | 社區志工（協力） | intake | dash, sites, intake, about |
| space | 空間組 | 總務處＋志工 | sites | dash, sites, intake, supplies, about |
| kitchen | 香積組 | 香積志工 | meals | dash, meals, supplies, about |
| supply | 物資組 | 倉管／總務 | supplies | dash, meals, supplies, about |
| care | 關懷組 | 訪視志工（安心膚慰） | care | dash, intake, care, about |
| med | 醫療組 | 人醫會 TIMA | care | dash, intake, care, about |
> 每個角色登入後 `home` 直接落在「自己該做的事」的分頁（醫療組落 care 並預設醫療子分欄）。

### 5.2 動作授權表（PERM）— 唯一裁決點
所有具副作用的動作經此表比對，UI 與 dispatcher 都查同一張表（禁在按鈕各寫 if）。
```
site.applyOpen    → [cmd]              申請開設據點
site.approveOpen  → [hq]              核准據點開設
intake.register   → [reg, cmd]        報到登記/分區配位
intake.discharge  → [reg, cmd]        退住（二次確認）
space.toggleCheck → [space]          整備檢核表勾選
care.log          → [care, med]      關懷/醫療紀錄
meal.save         → [kitchen]        備餐計畫/出餐登記
req.create        → [kitchen,supply,space,care,cmd]  建立物資請領
req.approve       → [cmd, hq]        核准請領（跨據點另檢核僅 hq）
req.issue         → [supply]         物資出庫
req.receive       → [kitchen,supply,space,care,cmd]  到貨簽收
donate.receive    → [supply]         捐贈驗收入庫
```

### 5.3 攔截機制（guard）
```js
const can = a => (PERM[a] || []).includes(S.role);
function guard(action, label){
  if(can(action)) return true;
  audit('越權攔截', `遭拒：「${label}」——現任「${ROLES[S.role].name}」，此操作需「${permOwners(action)}」`);
  commit();
  toast(`⛔ 權限不足：「${label}」需「${permOwners(action)}」。本次點擊已記入稽核軌跡。`, 'crit');
  return false;
}
const lk = a => can(a) ? '' : ' locked';  // 按鈕加 .locked（🔒 + 半透明）但仍可點→點了才攔截
```
- **設計要點**：無權限的按鈕**不隱藏**，而是加鎖視覺；點擊被攔截並寫稽核。演示時可實際點 🔒 觀察攔截＋toast＋稽核 +1。
- **跨據點二次檢核**：`approveReq` 內若 `r.cross && S.role!=='hq'`，即使 `req.approve` 通過（cmd 在表內）也額外攔截，並寫稽核。

### 5.4 角色切換
`setRole(r)`：切 `S.role`、`S.tab=home`、重設子分頁狀態、`commit()`、toast 告知。頂部有 `<select>` 角色切換器（演示用，模擬登入）。

---

## 6. 工作流（4 條狀態機）

### 6.1 據點開設狀態機
```
standby(平時待命) → prep(預警整備) → applying(開設申請中) → open(運作中) → scaling(縮編中) → closed(已關閉復原)
```
- `applyOpen(sid)`：standby/prep → applying（僅 cmd）。寫 applyAt/applyNote。
- `approveOpen(sid)`：applying → open（僅 hq）。設 openedAt、若無志工給 20、**自動建立三餐空排程**。不可重複核准（非 applying 即擋）。
- 演示：關渡 applying → hq 核准 → open。

### 6.2 收容安置流程
```
報到建檔 → 健康篩檢 → 分區配位 → 安置中(in) → 退住評估(二次確認) → 退住(out) → 社區訪視追蹤
```
- 以「戶」為單位。報到＝六連動 reducer（§7.1）。退住＝反向釋放（§7.2）。退住不刪戶、狀態轉 out 可查。

### 6.3 物資請領流程（狀態機）
```
pending(待核准) → approved(已核准待出庫) → issued(已出庫配送中) → received(已簽收) ／ rejected(已駁回)
```
- `createReq`(各組/cmd) → `approveReq`(cmd 本據點；跨據點限 hq)／`rejectReq` → `issueReq`(supply) → `receiveReq`(申請單位) → 簽收時庫存增加。
- 每步寫 `log[]` 與 audit，且不可跳步/重複（狀態不符即擋）。

### 6.4 香積餐食日循環
```
在住人數(系統即時) → 需求預估(含特殊餐分類) → 備餐計畫 → 出餐登記 → 餘量回報(修正明日)
```
- 需求預估 `dinnerForecast(sid) = 在住人數 + 駐點志工數`。填「實際出餐」即結餐（done=true）。

---

## 7. 資訊流（Reducer 規格）— 系統核心賣點

### 7.1 報到六連動 `registerHousehold(d)`（money shot）
**輸入** `d`：`{ head, idm, phone, addr, spaceId, members[] }`。

**前置檢查（任一失敗即中止、不改任何 state，回 `{ok:false, msg}`）：**
1. `members.length >= 1`（否則「每戶至少需登記 1 位成員」）
2. 目標 space 存在、屬本據點、`cap` 非 null（否則「請選擇收容分區」）
3. 該據點 `status==='open'`（否則「本據點尚未開設」）
4. `cap - occSpace(spaceId) >= 戶口數`（滿床拒報，訊息含剩餘床數）
5. `idm` 未在在住名單重複（否則「此證號已有在住紀錄」）

**通過後一次改完（單一 commit）：**
| # | 連動 | 具體操作 |
|---|---|---|
| ① 空間占用 | `occSpace` 隱含 +N（透過新增戶自動反映） | push household，status='in' |
| ② 餐食預估 | `dinnerForecast` +N（含特殊餐分類統計自動由 `dietCounts` 反映） | 依 members 的 diet 分類 |
| ③ 物資保留/扣減 | bed/blanket/kit 各 `qty -= min(N, qty)`（**clamp≥0 不得為負**） | reserved 記實際保留數 |
| ④ 庫存警示 | 扣減後 `qty < safety` → 寫 audit「警示」＋建議請領量 `safety*2 - qty` | shortages（缺口）另記 |
| ⑤ 儀表板徽章 | `commit()` 觸發 `renderShellBits` 重算 | 待辦/警示/在住數 |
| ⑥ 稽核 | push audit「報到」，ref=戶號；缺口另 push「警示」 | |

**回傳** `{ok:true, id, hh, sp, n, before{spOcc,siteOcc,dinner,audit}, reserved, shortages, alerts, diets, sid}` → 供連動摘要面板顯示前後對照。

**種子計算範例（演示標準劇本）**：板橋報到 5 口（含 1 糖尿病長者 + 1 嬰兒）到 sp1：
- 空間占用 16 → 21（+5）
- 晚餐預估 102 → 107（+5；糖尿病餐 +1、嬰兒副食 +1）
- 福慧床 30→25、環保毛毯 18→13（跌破安全庫存 15 → 警示）、盥洗包 34→29（各 −5）
- 稽核 +1（若毛毯警示則 +2）

### 7.2 退住反向 `dischargeHousehold(hhId)`
- 前置：戶存在且 `status==='in'`（否則回 null，擋重複退住）。
- 一次改完：`status='out'`、`checkout=now`、算 `followUp`（成員有特殊需求 or 有追蹤旗標關懷紀錄）、福慧床回庫（`bed` 數量），毛毯/盥洗包（消耗品）**不回補**、寫 audit「退住」。
- 回傳供反向連動摘要：空間釋放 −N、餐食下修、床回庫 +bedBack、若 followUp 則轉社區訪視追蹤名單 +1、在住總數下修、稽核 +1。
- **設計假設（待裁決）**：退住物資回補規則「床回庫、毛毯盥洗包不回補」為預設值，可調。

### 7.3 衍生查詢（唯一口徑，禁各處重算）
```
siteOf(id) spacesOf(sid) hhIn(sid)[status==='in']
occSpace(pid)=Σ該空間在住戶口數  occSite(sid)  capSite(sid)=Σspaces.cap
stockOf(sid,iid)  stockCls(r)  lowStock(sid)[qty<safety且非設備]
openSites()  dinnerForecast(sid)=occSite+volunteers
dietCounts(sid){diabetic,soft,infant,allergy}  healthFlagged(sid)  followList()
pendingReqsFor()[依角色:hq看全部pending;cmd看本據點非跨據點pending]
todoCount()  tabBadge(t)  ← 徽章數字，依角色計算
```

---

## 8. 模組規格（8 分頁逐一）

> 通用：每頁 `pageHead(title, sub, actions)` + 內容 + `footHTML()`。views 映射 `{dash,sites,intake,care,meals,supplies,staff,about}`。`renderView` 若當前角色無此 tab 權限則落 home。

### 8.1 dash 總覽儀表板（依角色顯示不同重點）
- **燈號警示列**（`.alert-strip`，頂部）：緊急庫存數／偏低庫存數／我的待辦數（角色）／據點運作數。呼應「3 秒看到有沒有事」。
- **4 統計卡**：收容中人數（全據點含使用率）／在住戶數（+退住/追蹤數）／今晚餐食預估／庫存警示數。
- **據點狀態卡（gauto grid）**：每據點狀態 chip、容量 meter、指揮/志工、空間配置按鈕、（applying→核准鈕 / standby→申請鈕，帶 lk）。
- **待辦卡（依角色動態）**：hq＝待核開設+待核請領；cmd＝待核本據點請領；supply＝待出庫+待簽收+待驗收捐贈；kitchen＝未排備餐；care/med＝追蹤名單；reg＝開始報到入口。每項帶跳轉按鈕。
- **庫存警示卡**：全據點 lowStock 的 meter 列 + crit/warn chip。
- **特殊餐彙總卡**：dietCounts 四類 meter。
- **稽核軌跡卡**：hq 看全域、其餘看本據點/本角色。最新 7 筆時間線，越權攔截標紅。

### 8.2 sites 據點與空間
- 據點切換 signal 列（點選切 `S.site`）。
- 狀態卡：applying→核准區（含核准鏈說明）；standby→平時待命（申請鈕）。
- 據點資訊卡 + 平時整備檢核表卡（check-list，可勾，帶 `space.toggleCheck` 權限；完成比例 chip）。
- 收容分區配置表：每空間 樓層/分區/容量/在住/使用率 meter/剩餘床（剩餘 0 標紅、≤4 標橙）。服務空間另列。

### 8.3 intake 報到與住民（核心）
子分頁：報到登記 / 住民清單（可搜尋） / 已退住。
- **報到登記**：步驟條（報到建檔→健康篩檢→分區配位→安置完成）。若非 open 顯示空狀態。戶長資料（姓名*/證號遮罩/電話/地址）+ 成員動態列（姓名*/年齡/性別/飲食/特殊需求 checkbox）+ 分區 select（顯剩餘床、滿床 disabled）。「完成報到」→ `submitIntake`→ 驗證 → reducer → 連動摘要面板。表單自動預帶 1 列成員。
- **住民清單**：搜尋框（戶長/成員姓名）+ 表格（戶長/口數/分區/特殊註記 chip/報到時間/關懷紀錄數鈕/連動紀錄鈕/退住鈕）。退住帶 `intake.discharge` lk。
- **已退住**：表格（含退住時間、後續追蹤 chip、連動紀錄鈕）。不消失可查。
- **連動紀錄** `showLinkage(hhId)`：Modal 時間線，篩 `audit[ref===hhId]`，回查該戶所有連動。

### 8.4 care 個案關懷
子分頁：關懷紀錄 / 醫療（人醫會） / 追蹤名單。醫療組登入預設落醫療子分欄。
- **新增紀錄表單**：關懷住戶 select、類型（med 角色固定「醫療」不可改）、志工姓名*（提示「膚慰是人對人，每筆留志工名字」）、內容*、列入追蹤 checkbox。
- **醫療子分欄**：健康旗標住民表（報到篩檢彙總——報到組登一次，人醫會即時看到，不重複問災民）+ 醫療類紀錄。
- **追蹤名單**：followList（已退住+追蹤）+ 追蹤旗標關懷紀錄。呼應「安生」。

### 8.5 meals 香積餐食
- 3 餐卡：需求預估（住民+志工，即時連動）/ 已出餐則顯計畫vs產量vs出餐vs餘量 / 未出餐則填備餐計畫/產量/出餐（帶 `meal.save` lk，建議量 = 預估×1.08）。
- 今日三餐長條圖（預估 vs 實際出餐雙色 bar + 圖例）。
- 特殊餐備製清單（dietCounts meter）。
- 明日預估卡。全餐素食（香積飯為後備糧）。

### 8.6 supplies 物資設備
子分頁：庫存總覽 / 請領單 / 捐贈入庫。
- **庫存總覽**：民生物資表（品項/現量/安全/水位 meter/狀態 chip/建立請領鈕）+ 設備區（發電機/照明 chip）。水位刻度＝安全×2。
- **請領單**：建單表單（品項/數量*/跨據點 checkbox→來源據點/事由*）。列表：每單 id/狀態 chip/跨據點標記/品項數量/申請人/核准人 + 步驟條（申請→核准→出庫→簽收）+ 動作鈕（依狀態與權限顯示核准/駁回/出庫/簽收，帶 lk）。
- **捐贈入庫**：捐贈列表 + 驗收鈕（`donate.receive`）。徵信規範說明。

### 8.7 staff 志工人力（唯讀）
統計卡（駐點志工/全事件動員/香積佔比）+ 各組早午晚班需/實表 + 缺班/足班 chip。標「演示版唯讀」。四合一動員說明（合心協調/和氣承擔/互愛帶動/協力執行）。

### 8.8 about 制度說明（演示講稿頁，靜態 HTML/CSS 圖）
- **命名理念卡**（安身安心安生對應）。
- **工作流**：4 條靜態流程圖（fnode + farr 箭頭，hot/okn 著色）。
- **資訊流**：報到一次寫入 → 6 節點連動圖 + 說明（單一 reducer、無第二份真相）。
- **權限流**：模組可見矩陣（由 `Object.keys(ROLES)`×`Object.keys(TABS)` **程式生成**，保證與實際一致）+ 關鍵動作授權表（由 PERM 生成）+ 核准鏈流程圖 + 開設 RACI 表。
- **演示動線**（3 分鐘腳本）+ **設計前提與待確認**清單。

---

## 9. 連動摘要 Money Shot 規格
報到/退住成功後 `openModal` 顯示：
- 戶卡置中（戶名・口數・安置分區）。
- **6 個氣泡 3欄格**（`.bubble`），每個 scale-pop 動畫，`animation-delay: i*90ms`（依序彈出）。
- 氣泡內容：圖示 + 前→後數值 + 說明標籤。方向著色：`.up`(藍,增)/`.down`(橙,減)/`.alert`(紅框,跌破安全庫存)。
- 若有物資缺口→紅色缺口卡；若有低庫存警示→建議請領註記。
- 「完成」鈕關閉 + 「查看住民清單」鈕。
> 這是演示的視覺高潮：讓觀眾 3 秒看懂「一次報到，六處同時連動」。禁用純文字六行列表。

---

## 10. 防呆規則清單（逐條可驗，對應驗收）
| # | 規則 | 實作點 |
|---|---|---|
| ① | 空間滿 → 拒報，訊息含剩餘床數 | reducer 前置檢查 4 |
| ② | 戶內 0 口/空白 → 擋「至少 1 位」 | 前置檢查 1 + 表單過濾空成員 |
| ③ | 同證號重複報到 → 擋 | 前置檢查 5 |
| ④ | 庫存不足配發 → 記缺口+警示，clamp 不為負 | `min(N, qty)` |
| ⑤ | 退住兩次 → 回 null 擋 | discharge 前置 |
| ⑥ | 退住後戶不消失、狀態 out 可查 | 不刪除、已退住分頁 |
| ⑦ | 越權點擊 → 攔截+toast+稽核 | guard() |
| ⑧ | 重複核准（開設/請領）→ 狀態不符擋 | 各 reducer 狀態前置 |
| ⑨ | localStorage schema 版本鍵，不符重置；表單未提交不入 store | VER 比對、UI 物件隔離 |

---

## 11. 慈濟語彙與文化約束（每次產出前逐條過）
**必用語彙**：香積（非「伙食/廚房」）、人醫會（TIMA）、訪視志工、感恩戶/照顧戶（非「受助者」）、福慧床、環保毛毯、協力/和氣/合心/互愛（四合一，非「組長/隊長」）、安心膚慰、安身安心安生。
**禁**：用「效率」壓過「用心」；把關懷全自動化（關懷紀錄必留志工姓名，保留「人的互動」節點）；假設外商 SOP＝更好（志工動機驅動）；直接建議組織扁平化（尊重既有決策文化）。

---

## 12. 驗收條件（AI 完成後須自檢，對應已通過的 50 項）
1. 375/390/768/1440 四寬度：console 零錯誤、無水平捲動、導覽可用（≥1024 側欄 8 項，<1024 頁籤 8 項）。
2. 8 分頁全可切換且標題/內容不重複。
3. 8 角色切換改變可見分頁；越權點擊被攔+toast+稽核留「越權攔截」。
4. 報到 5 口（含糖尿病+嬰兒）→ 空間+5／晚餐+5（糖尿病餐+1、嬰兒副食+1）／床毯包各−5／稽核+1／連動摘要 6 氣泡。
5. 防呆：滿床拒報、0 口擋、重複證號擋、庫存 clamp 不為負。
6. 工作流：核准關渡開設→運作中且不可重複；請領 申請→核准→出庫→簽收 全鏈+簽收後庫存增；跨據點由據點指揮核准被攔（僅總指揮可核）。
7. 退住：空間釋放、餐食下修、福慧床回庫、有需求轉社區訪視、重複退住擋、已退住可查。
8. localStorage 持久化（重整仍在）+「重置演示」還原種子。
9. 制度說明含工作流/資訊流/權限流三節；權限矩陣由 ROLES/PERM 生成，抽查 3 格與實際按鈕一致。
10. 全站正體中文；慈濟語彙齊備。
> 建議用 Playwright 寫文字驗證腳本（起 http server → 各寬度切分頁收 console → 操作報到/核准/退住比對 state 數字）。

---

## 13. 設計假設與待裁決項（正式化前需確認）
1. **退住物資回補**：預設「福慧床回庫、毛毯/盥洗包（消耗品）不回補」——可調。
2. **餐食預估口徑**：在住人數 + 駐點志工數；特殊餐由報到健康篩檢自動彙總。
3. **個資最小化**：證號/電話僅存遮罩；正式版須加驗證與加密存放。
4. **離線同步**：本原型單機 localStorage；正式版建議中央資料庫 + 離線同步（災時斷網為常態）。
5. **越權採「攔截+鎖視覺」而非隱藏按鈕**：讓使用者知道有此功能但無權，並留稽核；正式版可依資安政策改為隱藏。

---

## 14. 演示動線（3 分鐘標準腳本）
1. **總指揮中心**看儀表板：燈號、待核事項（關渡開設申請）——權限流視角差異。
2. 切**報到組**→ 報到 5 口（糖尿病長者+嬰兒）→ **六氣泡連動摘要**——資訊流 money shot。
3. 毛毯跌破安全庫存 → 切**空間組**建跨據點請領 → 切**據點指揮**點核准被**攔截**（跨據點限總指揮）→ 切**總指揮**核准 → **物資組**出庫 → 簽收——工作流全鏈。
4. 切**總指揮**核准關渡開設 → 狀態機轉運作中。
5. **報到組**示範防呆：滿床拒報、重複證號攔截、退住二次確認。
6. 回制度說明頁講三流架構；任意角色點 🔒 按鈕 → 攔截寫稽核。
> 重置：右上「重置演示」還原種子情境。

---

## 15. 部署
- 單檔 `index.html` 放任意靜態主機（GitHub Pages / Netlify / 內網）即可，無建置步驟。
- 本專案路徑：`TC-drms/shelter/index.html`，GitHub Pages 公開於 `https://wrvulcan-rgb.github.io/TC-drms/shelter/`。
- 離線可用：存檔後無網路亦可操作（localStorage）。

---

*（本規格書描述的系統為 vibe coding 演示原型；資料虛構、無真實個資。慈濟大型災害收容安置管理系統 v1。）*
