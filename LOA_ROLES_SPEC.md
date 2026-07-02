# LINE OA 角色 × 串接點按鈕規格
> 供 WORKSHOP_C（全流程演練）角色卡設計輸入。每組按鈕的最終定案由工作坊實測決定，本文件是起點不是終點。
> 佐證來源：慈濟官網災害救助頁、台南強震安心家訪紀錄、人醫會 TIMA、造冊發放報導；細節頁多數 403，部分標註「假設:訓練知識合成」。

---

## 一、串接點定義

一顆按鈕算「有串接」＝ 對應一個 GAS ACTION（`gas/config.gs`）＋ 一筆 DATA/RTDB 寫入。缺一個就是斷鏈。

| # | 串接點 | 現有 GAS ACTION | 寫入目標 |
|---|--------|----------------|----------|
| ① | 報到 | `CHECKIN` | registry + Sheets + RTDB checkins |
| ② | 接單/派工 | —（缺） | RTDB tasks + DATA.tasks.items |
| ③ | 執行回報 | `TASK_DONE`、`handleImage`（照片） | tasks.status + persons.timeline |
| ④ | 叫料 | `SUPPLY_START/ITEM/QTY` | warehouse.reqs + RTDB supply_reqs |
| ⑤ | 到貨簽收 | `SUPPLY_RECV` | reqs.status='已送達' |
| ⑥ | 安全點名/SOS | `SAFE`、`SOS` | SAFETY + RTDB sos |
| ⑦ | 交接 | —（缺，Phase 1-D） | RTDB handover 快照 |
| ⑧ | 結案 | —（缺） | persons.phase='結案' → 回寫 relief_req |

---

## 二、角色收斂原則

**不把組織圖直接映射成 LOA 角色。** 慈濟志工年齡層偏高，角色越多、按鈕越多＝現場教學成本爆炸。收斂為 6 個權限面：

```
志工 / 班長 / 司機 / 香積 / 訪視 / 幹部
```

- 評估師伯、醫療組：用「志工角色 ＋ 任務類型觸發的 Flex 卡」實現，不開獨立角色。
- 人文真善美：走現有 `drive` 照片分類頁 ＋ GAS `handleImage`，不做重複入口。
- 清掃/以工代賑：就是一般志工＋任務類型。
- 造冊發放：幹部端後台功能，不是前線按鈕。

---

## 三、角色 × 按鈕規格

### 1. 志工（現有，補 1 顆）

| 按鈕 | 串接點 | ACTION | 狀態 |
|------|--------|--------|------|
| ✅ 報到 | ① | `CHECKIN` | ✅ 現有 |
| 📦 叫料（三步驟） | ④ | `SUPPLY_*` | ✅ 現有 |
| 📡 安全回報 | ⑥ | `SAFE` | ✅ 現有 |
| 🆘 SOS | ⑥ | `SOS` | ✅ 現有 |
| **✓ 任務完成** | ③ | `TASK_DONE` | ✅ 已實作（模擬端，統一走 completeTask 回寫 persons.timeline） |

### 2. 班長（缺，P0 優先）

ARCH_V2 以 Squad 為執行主體、明寫「班長APP 目前透過 LINE OA 代替」，但 LOA 無班長角色＝整個 Squad 模型沒有行動端入口。
**狀態：✅ 模擬端 5 顆已實作（單班 SQ-01；高風險任務接單自動攔截轉幹部覆核）；GAS `squad_*` ACTION 待串接；DATA.squads 正式 schema 待 Phase 0-A。**

| 按鈕 | 串接點 | ACTION（需新增） | 寫入 |
|------|--------|-----------------|------|
| 🎯 接單 | ② | `squad_accept` | tasks.assignee + 通知班員 |
| 👥 班員點名 | ⑥ | `squad_rollcall` | SAFETY（班級粒度） |
| 📈 進度回報 | ③ | `squad_report` | tasks.pct + persons.timeline |
| ⚠ 現場受阻 | ③ | `squad_blocked` | tasks.status='受阻' → 幹部端警示 |
| 🤝 交接快照 | ⑦ | `handover` | RTDB handover（系統自動彙整＋班長補空欄） |

### 3. 司機（現有，補 1 顆）

| 按鈕 | 串接點 | ACTION | 狀態 |
|------|--------|--------|------|
| 🚛 查看派送單 + ✅ 已到貨 | ⑤ | `SUPPLY_RECV` | ✅ 現有 |
| **🚚 出發回報** | ③ | `depart`（需新增） | ⬜ 缺——幹部/班長端才看得到 ETA |

### 4. 香積組

熱食是每場必開、量最大的重複性資訊流；開伙數直接驅動倉儲預估。
**狀態：✅ 模擬端 3 顆已實作（掛既有 DATA.kitchen；開伙數回寫 DATA.field 便當供需；叫料品項已加白米/蔬菜並同步 gas/config.gs）；GAS `meal_*` ACTION 待串接。**

| 按鈕 | 串接點 | ACTION | 備註 |
|------|--------|--------|------|
| 🍱 今日開伙數登記 | ③ | `meal_count`（需新增） | 寫 DATA.field 供需預估 |
| 📦 食材叫料 | ④ | `SUPPLY_*` | 沿用三步驟，品項清單加食材類 |
| ✅ 出餐完成 | ③ | `meal_done`（需新增） | 供幹部端統計 |

### 5. 訪視/安心家訪組

原型 C「個案全程陪伴」的行動端入口；台南強震曾一次開 150+ 條家訪動線。直接寫 `persons.timeline`。
**狀態：✅ 模擬端 4 顆已實作（複用 applyWelfare／referPersonPsych 既有流程，全數寫入 persons.timeline＋careStats）；GAS `visit_*` ACTION 待串接。**

| 按鈕 | 串接點 | ACTION（需新增） | 寫入 |
|------|--------|-----------------|------|
| 🏠 開始訪視 | ③ | `visit_start` | persons.timeline + visitStatus |
| ✍ 完成訪視＋關懷紀錄 | ③ | `visit_done` | persons.timeline + careStats |
| 💰 慰問金申請 | ⑧ | `aid_request` | persons.reliefLog（進五步驟審核鏈） |
| 🧠 轉介心理 | ⑧ | `psych_refer` | persons.psych + longCare |

### 6. 幹部（現有，補 2 顆）

| 按鈕 | 串接點 | ACTION | 狀態 |
|------|--------|--------|------|
| 📢 發送廣播 | — | push | ✅ 現有 |
| 📡 發起點名 | ⑥ | rollcall 推播 | ✅ 現有 |
| 🎯 查看任務 | ② | — | ✅ 現有 |
| **✅ 高風險派工覆核** | ② | `risk_approve`（需新增） | ⬜ 缺——前端已有 `rtGuardHighRiskAssign` 守門，LOA 端無對應通知卡 |
| **📋 結案確認** | ⑧ | `case_close`（需新增） | ⬜ 缺——closePersonCase 的行動端觸發 |

### 任務類型觸發卡（不開角色）

| 觸發 | Flex 卡按鈕 | 串接點 |
|------|------------|--------|
| 任務類型＝評估 | 📋 開始評估 / 📷 評估照片 / ✅ 提交評估表 | ②③ |
| 任務類型＝醫療 | 🩹 傷患回報 / 📦 醫療耗材叫料 | ③④ |

---

## 四、優先序

| 序 | 項目 | 理由 |
|----|------|------|
| 1 | 班長角色 5 顆 | Squad 模型無行動端入口，ARCH_V2 核心斷點 |
| 2 | 志工補「✓ 任務完成」 | GAS 已就緒，一顆按鈕接通③ |
| 3 | 香積組 | 每場必開、資訊流量最大 |
| 4 | 訪視組 | 原型 C 閉環的行動端入口 |
| 5 | 幹部補覆核/結案 | 對齊高風險守門與結案回寫 |

---

## 五、待工作坊定案（不要先寫死）

- 各組按鈕文案與順序（WORKSHOP_C 實測，老年志工可用性優先）
- 班長點名粒度（班 vs 動線）
- 慰問金五步驟審核鏈的角色對應（WORKSHOP_B 授權矩陣）
- 香積開伙數與倉儲預估的換算邏輯
