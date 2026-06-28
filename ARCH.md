# TC-DRMS 系統架構地圖

> 本文件是 Claude 的導覽索引。每次談修改前先指這裡定位，不用重讀整份大檔。
> 拆檔後路徑欄會更新。

---

## 檔案結構（拆分後目標）

```
TC-drms/
├── index.html          ← 骨架 HTML（pages + 引用）
├── style.css           ← 全域樣式（原 L8–604）
├── arch-style.css      ← 心智圖樣式（原 L1494–1693）
├── arch-script.js      ← 心智圖腳本（原 L1788–2285）
├── app.js              ← 主應用邏輯（原 L2290–8842）
└── ARCH.md             ← 本文件
```

---

## HTML 頁面（Pages）一覽

| page id | 標題 | HTML 行 | 主 render fn |
|---|---|---|---|
| `dashboard` | 總控儀表板 | 內嵌於 main | `renderAll()` |
| `vol_hub` | 志工人力中心 | 1003 | `renderVolHub()` |
| `monitor` | 全域監控 | 1070 | `renderMonitor()` |
| `admin` | 系統管理 | 1108 | —（tabs: sys/perms/api/...） |
| `case_mgt` | 個案管理（舊，待移除） | 1271 | `renderCaseMgt()` |
| `care_rec` | 關懷行動（舊，待移除） | 1276 | `renderCareRec()` |
| `warehouse` | 物資倉儲 | 1281 | `renderWarehouse()` |
| `shelter_mgt` | 安置收容 | 1286 | `renderShelterMgt()` |
| `relief_req` | 民眾求助通報 | 1292 | `renderReliefReq()` |
| `coord` | 跨單位資源協調 | 1303 | `renderCoord()` |
| `rebuild` | 災後重建（舊，待移除） | 1314 | `renderRebuild()` |
| `persons` | **個案全程陪伴（整合）** | 1325 | `renderPersons()` |
| `line_oa` | Line OA 手機模擬（角色視角 + 資料流說明） | 1439 | `renderLineOA()` / `setLOARole()` |
| `drive` | 照片回報與分類 | 1443 | `renderDrive()` |
| `sorting` | 物資整理站 | 1449 | `renderSorting()` |
| `assets` | 慈濟資產調度 | 1461 | `renderAssets()` |
| `rtsync` | 即時調度中台 | 1472 | `renderRTSync()` |
| `arch_doc` | 系統架構說明（心智圖） | 1493 | `renderArchDoc()` |

---

## 資料模型（DATA.*）— app.js 行號

| 物件 | 內容 | 行（原單檔） |
|---|---|---|
| `DATA.relief_req` | 民眾求助通報：收件匣、地圖 | 4394 |
| `DATA.coord` | 跨單位協調：媒合、單位、分區 | 4405 |
| `DATA.rebuild` | 災後重建（舊，供 renderRebuild 用） | 4428 |
| `DATA.devTasks` | IT 待辦 | 4439 |
| `DATA.persons` | **個案全程陪伴（統一模型）** | 4459 |
| `DATA.case_mgt` | 個案管理（舊） | 4480 |
| `DATA.care_rec` | 關懷行動（舊） | 4489 |
| `DATA.warehouse` | 物資倉儲 | 4499 |
| `DATA.shelter_mgt` | 安置收容 | 4513 |
| `DATA.registry` | 志工報名報到 | 4523 |
| `DATA.assets` | 慈濟資產（福慧床/帳篷/...） | 4549 |
| `DATA.sorting` | 物資整理站 | 4565 |
| `DATA.drive` | 照片分類回報 | 4606 |
| `DATA.field` | 即時調度中台（物資/人力/任務） | 內嵌 app.js 頂部 |

---

## 主要函數群（app.js 行號）

### 系統骨架
| 函數 | 行 | 說明 |
|---|---|---|
| `showPage(id)` | 5427 | 切換頁面，觸發對應 render |
| `setRole(r)` | 5498 | 切換角色（admin/it/staff/logistics） |
| `setS(s)` | 5510 | 切換模式（peace/war） |
| `renderNav()` | 5372 | 重繪導覽列 |
| `saveData()` | 7501 | 序列化 DATA.* → localStorage |
| `loadData()` | 7955 | 還原 localStorage → DATA.* |
| `toast(msg)` | 6373 | 右下角提示 |
| `logSys(lvl,msg)` | 7346 | 系統事件紀錄 |

### 即時調度中台（rtsync）
| 函數 | 行 | 說明 |
|---|---|---|
| `renderRTSync()` | 2767 | 主 render |
| `setRTTab(t)` | 2748 | 切分頁（tasks/report/close/emergency/**loa**） |
| `renderRTLoa()` | app.js ~1931 | Line 串接 tab，包含 LOA 操作面板 + 推播 log |
| `renderRTTasks()` | 2974 | 任務池 |
| `rtWizOpen()` | 2811 | 新增任務精靈 |
| `triggerSOS()` | 2675 | SOS 觸發 |
| `renderRTEmergency()` | 3624 | 緊急分頁 |

### 個案全程陪伴（persons）— **原型 C 整合**
| 函數 | 行 | 說明 |
|---|---|---|
| `renderPersons()` | 8312 | 主 render，依 PERSONS_TAB 分派 |
| `setPersonsTab(t)` | 8304 | 切分頁（cases/care/rebuild） |
| `renderPersonsCases()` | 8318 | 個案名單（急救期+重建期統一） |
| `advancePersonCase(i)` | 8352 | 推進訪視狀態，寫 timeline |
| `renderPersonsCare()` | 8368 | 關懷紀錄（含統計卡片） |
| `logPersonsMeal()` | 8390 | 定點供餐登記 |
| `renderPersonsRebuild()` | 8400 | 重建追蹤（進度條+心理狀態） |
| `advancePersonRebuild(i)` | 8428 | 推進重建階段 |
| `referPersonPsych(i)` | 8440 | 轉介心理師 |

### 戰時啟動
| 函數 | 行 | 說明 |
|---|---|---|
| `wtPickScenario(s)` | 6652 | 選災型 |
| `wtPickLevel(l)` | 6677 | 選受災等級 L1/L2/L3 |
| `wtConfirmAndLaunch()` | 6743 | 套用並進入戰時 |
| `loadWarModuleDefaults()` | 6639 | 讀各災型/等級預設模組清單 |

### 心智圖（arch_doc）
| 函數 | 行（arch-script.js） | 說明 |
|---|---|---|
| `renderArchDoc()` | 2482 | 心智圖入口 |
| `renderArchGraph()` | 2412 | SVG 節點繪製 |
| `selectNode(id)` | 2118 | 點選節點 |
| `storyShow(i)` | 2128 | 故事導覽 |

---

## 模組導覽設定

### NAV_MODULES（app.js L5281）
控制左側導覽列項目、群組、角色可見性。

### 戰時情境模組清單（app.js L6555–6640）
10 種災型 × 3 等級（L1/L2/L3）的 `modules[]` + `hidden[]` 矩陣。
**格式**：`scenarios[type][level].modules` / `.hidden`

---

## 原型架構（概念層）

```
原型 A：資源流動   → warehouse / assets / coord（待整合）
原型 B：需求通報   → relief_req / Line OA（已部分整合）
原型 C：個案全程   → persons ✅（已整合 case_mgt + care_rec + rebuild）
原型 D：人員報到   → vol_hub（registry 子頁）
```

---

## 待辦 / 已知問題

| 優先 | 模組 | 問題 |
|---|---|---|
| P1 | 全系統 | 個資明文存 localStorage（idno/phone 未加密） |
| P1 | admin | role 前端可竄改，需移後端驗證 |
| P1 | line_oa | 真實 Webhook 0%，目前純模擬 |
| P2 | persons | case_mgt/care_rec/rebuild 舊頁面 HTML 仍存在，待清除 |
| P2 | vol_hub | GAS /exec 網址未設定 |
| P3 | dashboard | SOS 按鈕缺「→ 調度中台緊急 tab」快捷 |
| P3 | arch_doc | #node-detail / #codegen selector 不存在 |
