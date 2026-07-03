# 資訊鏈架構圖 v1 → DRMS 採納清單

日期：2026-07-03
來源：慈濟救災 × LINE OA 完整資訊鏈架構圖 v1（九階段 × 五泳道）
性質：差異分析後判定 **DRMS 目前缺少、且值得採納** 的 6 個設計，各附現況證據與落地點。本檔是規格採納，不是實作——實作進度回填 LOA_ROLES_SPEC.md / ARCH_V2_SPEC.md。

## 差異分析摘要

| # | 想法 | DRMS 現況 | 判定 |
|---|------|-----------|------|
| 1 | 接單狀態機（accepted/declined/timeout 遞補＋防搶人） | 只有幹部單向指派（app.js `rtAssignTask`）；`squad_accept` 僅模擬（LOA_ROLES_SPEC.md:56-58） | 缺，P1 |
| 2 | 訊息成本紀律（禁 broadcast、narrowcast 分眾、reply 優先） | gas/push.gs 有 reply/push 兩路但零成本控管邏輯 | 缺，P1 |
| 3 | 備援鏈（SMS／電話樹／紙本代登） | 只有 localStorage 斷網暫存，無「LINE 平台不可用」備援 | 缺，P1 |
| 4 | 貫穿式事件生命週期 S1–S9 | 各模組各自狀態欄位（task／case phase／relief_req.status），無單一狀態機 | 缺，P2 |
| 5 | KPI 覆盤四指標 | dashboard 只有原始計數（志工到位 142/200），無計算欄位 | 缺，P3 |
| 6 | 派遣前提三資產（名冊綁定／個資留存／非志工分流） | registry 有報到但無 skills×district×availability 派遣篩選模型 | 部分缺，P1 |

---

## 1. 接單狀態機（P1 核心）

現況是「幹部單向指派」，志工端無接受／婉拒，也無逾時處理。採納：

```
assignment{ task_id, user_id, status, responded_ts }
status: pending → accepted | declined | timeout
```

- **逾時遞補**：pending 逾 30min → 標 timeout → 派遣引擎取候補名單發下一批 → 直到 quota 滿足或名冊耗盡 → 耗盡則升級通知幹部。
- **防搶人**：同一 user 同時段僅允許一筆 accepted，接單時檢查時段衝突。
- 落地點：DATA 新增 `assignments`；LOA_ROLES_SPEC.md「班長接單 squad_accept」擴為完整狀態機；gas 新增對應 ACTION。

## 2. 訊息成本紀律（P1，零碼可先立規）

gas/push.gs 已分 `replyText/replyFlex`（replyToken，免費）與 `pushText/pushFlex`（計費），但沒有任何政策層。採納規則：

- **禁 broadcast**：大型災害全帳號廣播會直接燒穿訊息額度。
- 派遣用 **narrowcast 分眾**：單次成本＝名單人數 × 1 push。
- 接單／婉拒／確認卡全走 **postback + reply**（0 訊息成本）。
- 結案通知全體 push×1，其餘狀態更新不主動推。
- 落地點：gas/handlers.gs 派工路徑強制走 narrowcast；程式層封鎖 broadcast 呼叫。

## 3. 備援鏈——不是選配（P1）

現有 localStorage 離線暫存只解決「志工手機斷網」，不解決「LINE 平台在災區不可用」。莫拉克、0403 花蓮的經驗都是災區先斷網——系統最被需要的時刻恰是 LINE 最不可用的時刻。採納：

| 階段 | 備援 | 系統面要求 |
|------|------|-----------|
| 通報 | 119／里辦轉報 | 後台人工代 key 入佇列 |
| 派遣 | SMS 簡訊（派遣摘要＋回撥碼） | SMS 發送觸發條件 |
| 接單 | 電話樹逐級確認 | 後台「代登介面」：幹部代 key 志工狀態 |
| 簽到／結案 | 紙本表單 | 事後補掃入系統 |

- 關鍵新元件＝**後台代登介面**（幹部代志工登記狀態），觸發條件與介面須進 P1 範疇，不能排到 P3。

## 4. 貫穿式事件生命週期 S1–S9（P2，v2 整合方向）

通報→研判分級→派遣→接單→簽到→回報→結案→覆盤。每階段落地一個資料物件，以 `incident_id` 為 FK 貫穿：

```
report → incident → task → assignment → checkin → progress → closure → kpi
```

- 現況 relief_req／tasks／registry／persons 各自為政；v2 整合（ARCH_V2_SPEC.md handover 鏈）時以此為骨架，讓「一場災害」在系統裡是一條可追溯的鏈，不是四個模組的四筆資料。

## 5. KPI 覆盤四指標（P3，但欄位設計要現在定）

- **動員時效**：派遣發出 → quota 滿足
- **回應率**：accepted ÷ 推播人數
- **到位率**：checkin ÷ accepted
- **結案時長**：incident 建立 → closure 鎖定

全部從 assignment／checkin 的 timestamp 導出，**不用另建系統**——前提是想法 1 的狀態機每步都落 `ts`。這是「狀態機欄位設計」要現在定、報表可以晚做的原因。

## 6. 派遣前提三資產（S0，鏈外但最優先）

1. **名冊綁定**：`volunteer{ user_id, skills[], district, availability }`。沒這張表，派遣引擎無名單可篩，OA 退化成廣播頻道。落地點：registry 補 skills／district／availability 欄位＋LIFF 綁定流程。
2. **個資留存政策**：災民照片／GPS 屬敏感個資，結案後 N 日去識別化；覆盤 KPI 只用聚合值，不落個人明細。
3. **非志工分流**：richmenu 分「我要通報／我是志工」雙入口；未綁定者永遠進不了派遣名單，通報不設門檻。

---

## 優先序建議

- **P1（派遣閉環 MVP）**：1 接單狀態機 ＋ 2 訊息成本紀律 ＋ 6-1 名冊綁定 ＋ 3 備援代登介面。
- **P2**：4 貫穿生命週期（併入 v2 整合）。
- **P3**：5 KPI 報表（但 timestamp 欄位隨 P1 狀態機一起落）。
