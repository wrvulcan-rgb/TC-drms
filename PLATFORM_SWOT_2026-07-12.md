# TC-DRMS 平台優劣勢盤點與優勢放大提升清單（2026-07-12，第二輪追加 2026-07-13）

> **方法**：第一輪四路並行掃描——① 前端主應用（app.js 9,897 行＋index.html＋style.css＋intake.html）② GAS 後端＋測試實跑（15＋26 組全綠，exit 0）③ 15 份規劃/治理文件 ④ 架構圖子系統（arch-script v1/v2）。第二輪兩路深掘——⑤ 11 個業務模組逐一 UX/流程缺口 ⑥ 12 個橫切技術面向（render 效能/通知/GIS/行動裝置/報表/時間/協作/在地化）。所有結論附 file:line 證據。
> 提升清單共 **91 項**：第一輪 #1–#47（大架構層），第二輪 #48–#91（模組體驗與橫切技術層）。
> **假設**：「可提升優點的項目」解讀為「能放大既有優勢的具體改進項目」（含排除正在阻礙優勢發揮的劣勢），非單純 bug 修理清單。
> **本報告不改任何程式**，是決策與排期的底稿；優先級對齊 GROWTH_ROADMAP Phase 0–4。

---

## 一、平台現況座標（一段話）

TC-DRMS 是慈濟災害應變管理系統原型：零框架單檔前端（離線 localStorage 優先）＋ GAS 22 ACTION 後端（已寫好、待部署）＋ LINE OA 七角色模擬器 ＋ incidentId 血緣溯源與四 KPI ＋ AI 判讀規則引擎（已預留 Agent API 接點）。功能已鋪到「**接上真後端就能跑**」，目前卡在四個只有人能拍板的決策脊椎（要不要建後端／資料落地境內外／維運人力／AI 授權天花板）。真實 Webhook 0%、五場工作坊全部待排期＝**尚無真實使用者回饋進場**。

---

## 二、優勢盤點（32 項，分六層）

### 產品理念層
| # | 優勢 | 證據 |
|---|---|---|
| S1 | 平戰一體雙模式是**真狀態機**：戰時 master 資料唯讀鎖定、10 災型 × 3 等級模組矩陣動態開關、「解除戰時比進入更嚴」 | app.js:5314, 6247, 6520 |
| S2 | **incidentId 血緣脊椎**：sosId 升級為全系統血緣鍵，通報→派工→接單→物資→歷程→結案端到端溯源，純附加不改既有行為——平台最有護城河的資產 | app.js:4937-4992；SYSTEM_AUDIT §二 |
| S3 | 四 KPI（動員時效/接單回應率/到位率/結案時長）純由時間戳導出，非手填 | app.js computeKpiSummary；SYSTEM_AUDIT §二 |
| S4 | 資訊流閉環設計：發送→回流→搜集→AI 判讀→行動，總部搜集區讀真實 DATA/RTDB 非造假 | SYSTEM_AUDIT §二；renderLOACollect |
| S5 | LINE OA 資安分層定位清晰：「LINE 是管子不是保險箱」，訊號最小化、Sheets 為唯一真相、RTDB 僅暫態快取 | SYSTEM_AUDIT §四 |
| S6 | 角色收斂哲學：不映射組織圖，收斂 6 個 LOA 角色＋任務型觸發卡，直面志工年齡層與教學成本 | LOA_ROLES_SPEC.md:28-38 |
| S7 | 三條紅線自我約束：離線韌性優先／演練≠實戰／輔助角色定位 | FABLE_HANDOFF.md:30-33 |
| S8 | 演練模式 `?drill=1` 全域黃幅＋情境自動載入 | app.js:44-76 |

### 前端工程層
| # | 優勢 | 證據 |
|---|---|---|
| S9 | 零框架/零建置/零 npm 依賴，`<script src>` 即跑，部署與稽核成本極低 | 無 package.json/build config |
| S10 | 離線優先 localStorage 持久化（19 個 DATA_KEYS），寫入失敗 try/catch 降級 | app.js:7593-7620 |
| S11 | 企業級版本治理：自動流水號＋雙檔輪替備份＋每日時段三槽＋手動環形三槽＋一鍵還原 | app.js:7605-7716 |
| S12 | XSS 防護鎖在正確邊界：外部/Firebase 回流字串一律 `esc()`，並在注入點標註資安理由（F1/F2） | app.js:278, 502, 1090, 5698 |
| S13 | 前端權限分層：`can()` 單一守門＋P0-P4 個資動態遮蔽＋破窗提權留痕 | app.js:6357, 5406, 7359 |
| S14 | LINE OA 八角色雙手機模擬器，工作坊展示力極強 | app.js:2708, 2777, 3377 |
| S15 | ID 生日悖論碰撞防護（單調遞增 base36 尾碼） | app.js:22-25 |
| S16 | RWD 11 個斷點＋手機側欄滑動手勢 | style.css；app.js:9658 |
| S17 | 演練/config 容錯：`drms_config` 損毀 try/catch 回退預設，白屏根因已除 | SYSTEM_AUDIT #5 |

### 後端層（GAS）
| # | 優勢 | 證據 |
|---|---|---|
| S18 | 22 ACTION 覆蓋全部六角色，LINE postback 與網頁橋接**共用單一 routeAction**，邏輯不重複 | config.gs:41-70; webhook.gs:132-134 |
| S19 | fail-closed 驗證：零設定即 403；HMAC-SHA256 嚴格驗簽 | webhook.gs:66-99 |
| S20 | `_safePath()` Firebase 路徑消毒，杜絕 `../../` 穿越 | sheets.gs:51-57；測試 G14 |
| S21 | narrowcast 成本紀律：broadcast 預設不打 LINE API，僅指名逐一 push | webhook.gs:137-145；測試 G11 |
| S22 | 可選依賴 offline-first：Sheets/Firebase 未設即跳過，不阻斷 LINE 基本回覆 | sheets.gs:27, 60, 78 |
| S23 | health 端點只回布林不洩金鑰；密鑰集中 Script Properties | webhook.gs:41-55；測試 G13 |
| S24 | 逐事件錯誤隔離＋橋接動作全留稽核痕 | webhook.gs:24-30, 121 |
| S25 | 測試 15＋26 組全綠可實跑（node 即跑，零安裝），原型罕見的保護網 | test_gas_handlers.js; test_loa_integration.js |

### 治理文件層
| # | 優勢 | 證據 |
|---|---|---|
| S26 | AUTH_MATRIX_SPEC：約 25 ACT-id × 8 角色 × 金額/個資級距 × 平戰差分，從 22 處散落 if 逆向收斂成單一主矩陣 | AUTH_MATRIX_SPEC.md:86-167 |
| S27 | FABLE_HANDOFF 四決策脊椎交接文件，接手者可冷啟動；決策一律用 `〖…〗` 交還給人 | FABLE_HANDOFF.md |
| S28 | 四路稽核報告含「未修清單＋不修的理由」——誠實文化比假全綠可信 | SYSTEM_AUDIT_2026-07-09.md §三 |
| S29 | 錯誤帳本制度：固定格式/根因/防再犯/清掃狀態，與 session 開場綁定 | errors.md |
| S30 | 五階段成長路線圖＋工作坊方法論（每個 TODO 標「需要到場的人」） | GROWTH_ROADMAP.md; TODO_WORKSHOP.md |

### 架構視覺化層
| # | 優勢 | 證據 |
|---|---|---|
| S31 | 內嵌產品的活架構圖：30 節點帶設計理念、故事導覽逐段旁白、四視角、健檢著色＝路線圖＋風險看板一圖搞定 | arch-script.js:298-527 |
| S32 | INTAKE1 回饋碼閉環：看圖者可對節點寫回饋產生提交碼，把「看圖」接到「收斂共識」 | arch-script.js:632-642 |

---

## 三、劣勢盤點（26 項，分五層）

### 前端
| # | 劣勢 | 證據 |
|---|---|---|
| W1 | 單檔巨石：9,897 行／621KB，551 個頂層全域函式，任何接手都付巨額認知稅 | wc/grep 實測 |
| W2 | inline `onclick=` 462 處 vs addEventListener 10 處，標記行為耦合、強制全域函式、難測難拆 | grep 實測 |
| W3 | inline `style=` 約 1,270 處散落 JS 模板，改版式極痛 | grep 實測 |
| W4 | XSS 覆蓋缺口：innerHTML 169 處僅 44 處走 esc()；種子欄位直接插值（value="'+m.title+'"），欄位一開放編輯即成注入面；esc/escHtml 雙套並存 | app.js:4622, 5698, 8023 |
| W5 | 舊頁殘留：case_mgt/care_rec/rebuild 已淪為 persons 空殼別名仍佔 nav 與 HTML | app.js:9083-9126 |
| W6 | 計時器洩漏：rtCheckFatigue setInterval 永不 clear；stopRegPolling 從未呼叫 | app.js:9647 |
| W7 | saveData 每次 19 鍵全量序列化＋三重備份，與 localStorage 5MB 上限對撞 | app.js:7597-7616 |
| W8 | 展示與真實混淆：儀表板 KPI 硬編碼、7 處 Math.random 偽即時、真 fetch 僅 9 處 | app.js:3810-3858 |
| W9 | CDN 硬相依與離線定位自相矛盾：Leaflet(unpkg)/QR(api.qrserver.com)/Google Fonts，斷網即失效 | index.html:7-9,1199; app.js:5770 |
| W10 | a11y 近乎為零：index.html aria/role/alt 共 0 處——與「志工年齡層偏高」的定位直接衝突 | grep 實測 |
| W11 | 前端 render 零自動化測試（測試都在 GAS/LOA 契約層） | 專案僅 2 個 test 檔 |

### 後端
| # | 劣勢 | 證據 |
|---|---|---|
| W12 | GAS 平台天花板：配額/6 分鐘上限/冷啟動無任何處理；Script Properties 明文非真 secret 管理 | gas/ 全域 grep 零匹配 |
| W13 | 密鑰走 URL：WEBHOOK_TOKEN `?token=`、FIREBASE_SECRET `?auth=` 皆會落日誌 | webhook.gs:72; sheets.gs:63,81 |
| W14 | BRIDGE_KEY 下放瀏覽器可被讀出偽造，信任模型脆弱（自承固有） | SYSTEM_AUDIT F10 |
| W15 | 無交易/重試/冪等：多筆 rtdbWrite 部分失敗留不一致；dispatch 拋錯仍回 200→LINE 不重送，失敗被靜默吞掉 | webhook.gs:24-32; handlers.gs:319-355 |
| W16 | 無 CI（.github/ 不存在）＋無 clasp 部署自動化（人工貼 5 檔），倉庫↔線上必然漂移 | SETUP.md:19-29 |
| W17 | Firebase 安全規則不進版控，現況等同世界可讀（loaBridgePull 無 auth 讀整庫） | SYSTEM_AUDIT P1-1 |
| W18 | X-Line-Signature 在 GAS 讀不到 header，正式環境實際退回較弱的 token 驗證 | webhook.gs:61-65 |

### 資料與資安
| # | 劣勢 | 證據 |
|---|---|---|
| W19 | 個資明文存 localStorage/備份/RTDB（idno/phone），maskPII 僅畫面層 | ARCH.md P1; SYSTEM_AUDIT F3 |
| W20 | role 前端可竄改（console 設 role='admin' 全解鎖）；守門不對稱（rtDoAssign/applyWelfare 等未接 can()） | SYSTEM_AUDIT F4/F6/F7 |
| W21 | `?drill` 演練未真隔離，寫進正式 DATA——踩「演練≠實戰」紅線 | SYSTEM_AUDIT #4 |
| W22 | 無 schema migration：RTDB.seed 只在空時 seed，schema 演進後舊 localStorage 帶陳舊欄位 | FABLE_HANDOFF.md:60,153 |

### 架構視覺化
| # | 劣勢 | 證據 |
|---|---|---|
| W23 | 三套架構表述並存互相分歧（v1 30 節點／v2 14 節點／app.js ARCH_DOC 死碼 renderer），v1/v2 引擎 90% 逐行重複、CSS 半鏡像；v2 健檢徽章 id bug（arch-hb- vs arch2-hb-）永遠填不進；版號 v4/v5/v6 混亂；ARCH.md 行號全錯 | arch-script-v2.js:216,320; ARCH.md:117-120 |

### 治理
| # | 劣勢 | 證據 |
|---|---|---|
| W24 | SECURITY_APPROVAL 大量 `[待填]`、簽署欄全空白＝唯一法遵文件尚未生效 | SECURITY_APPROVAL.md:24-96 |
| W25 | 零真實使用者回饋：五場工作坊全部待排期，WORKSHOP_* 皆為設計者單方預想議程 | TODO_WORKSHOP.md:240-247 |
| W26 | 無 API 契約/使用者手冊/SOP/SLA/DR 手冊；自動 merge main 無 review gate（FABLE_HANDOFF 自點名的治理風險）；三套角色詞彙無 glossary 映射 | FABLE_HANDOFF.md:155-156 |

---

## 四、優勢放大提升清單（43 項）

> 每項標【放大的優勢】與優先級。**P0**＝立即/部署前（多為低成本高槓桿或決策項）；**P1**＝1 個月內；**P2**＝2–3 個月；**P3**＝3–6 個月＋。標 〖決策〗 者需 Mason／慈濟主責幹部拍板後才能動。

### A. 放大「incidentId 血緣＋KPI 溯源」（S2/S3——最有護城河的資產）

| # | 提升項目 | 做法要點 | 優先 |
|---|---|---|---|
| 1 | KPI 歷史留存與趨勢線 | 四 KPI 現為即時快照；per-incident 結案時封存至 `drms_kpi_history`，儀表板出趨勢線，讓 KPI 從「單點數字」變「管理工具」 | P1 |
| 2 | 血緣封存 → 演練劇本產生器（脊椎 D 資料飛輪第一步） | 結案 incident 一鍵匯出成 `?drill` 情境 JSON（含時間軸重放）；同時自動產出事件複盤摘要 | P2 |
| 3 | S1–S9 溯源泳道視覺化 | renderRTTrace 文字展開升級為五泳道時序圖（可沿用 arch 心智圖 SVG 引擎），工作坊展示力翻倍 | P2 |
| 4 | 統一稽核事件模型（脊椎 C） | auditLog/timeline/reportLog/reliefLog.chain 四套留痕統一 schema、全掛 incidentId；併入 reliefLog 既有 hash chain 做防竄改 | P1 |
| 5 | DATA schema 版本化＋migration 層 | DATA_KEYS 加 schemaVersion，loadData 時自動遷移，血緣欄位長期一致（解 W22） | P1 |
| 6 | 血緣鍵覆蓋率儀表 | 溯源頁加「孤兒事件」清單（無 incidentId 的任務/個案），驅動血緣覆蓋率→100% | P2 |

### B. 放大「平戰雙模式真狀態機」（S1/S7/S8）

| # | 提升項目 | 做法要點 | 優先 |
|---|---|---|---|
| 7 | `?drill` 寫入層真隔離 | 寫入層統一 drill namespace（`drms_drill_*`），演練不再污染正式 DATA（解 W21）；也是 AI 訓練資料紅線的前提 | P1 |
| 8 | 收班交接（handover）數位快照 | 直面工作坊核心痛點「收班無快照、下一梯從零開始」：收班一鍵產出班組/任務/物資快照，下一梯掃碼承接（ARCH_V2 交接鏈落地） | P2 |
| 9 | 戰時模組矩陣管理介面 | 10 災型 × 3 等級 modules/hidden 現硬編碼（app.js:6520），做成 admin 可視化編輯＋匯出入，幹部能自調不求工程師 | P2 |
| 10 | 平時日常化黏著功能 | 例行報到、演練排程、物資盤點到期提醒——「平時沒人用，災時一定沒人會用」的正面解，讓系統平時就有存在感 | P2 |
| 11 | 解除戰時複盤精靈 | war→peace 時自動走「KPI 報告→事件封存→演練劇本匯出」流程，把 S1 與 A 組串成閉環 | P2 |

### C. 放大「離線優先＋零依賴」（S9/S10/S11）

| # | 提升項目 | 做法要點 | 優先 |
|---|---|---|---|
| 12 | self-host Leaflet 與字型 | 去 unpkg/Google Fonts（解 W9 與 SRI 問題），斷網地圖仍可用（圖磚另評離線快取範圍） | P1 |
| 13 | QR 改本地產生器 | 去 api.qrserver.com——個資/報到碼不再外流第三方，同時消 F14 | P1 |
| 14 | PWA 化（manifest＋Service Worker） | 可安裝到手機桌面、斷網啟動、資產離線快取；對年長志工「點圖示就開」比記網址友善 | P2 |
| 15 | saveData debounce＋差異寫入＋配額儀表 | 全量三重寫入改節流；admin 顯示 localStorage 用量與 5MB 逼近警示＋匯出提醒（解 W7） | P1 |
| 16 | 一鍵韌性包匯出/匯入 | 19 鍵 DATA＋設定打包下載/還原（既有三槽備份的延伸），支援換機、災後轉移、合規歸檔 | P2 |

### D. 放大「GAS 後端骨幹＋fail-closed 資安」（S18–S25）

| # | 提升項目 | 做法要點 | 優先 |
|---|---|---|---|
| 17 | Phase 0 部署落地（總開關） | 部署 gas/＋Script Properties＋LINE Channel 綁 webhook＋真機驗證 22 ACTION 綠燈——所有「已實作待部署」優勢的變現點 | **P0**〖決策〗 |
| 18 | Firebase 安全規則收緊＋規則檔進版控 | 僅認證服務帳戶可讀寫、前端讀改走 GAS 代理；rules.json 入 repo 受審（解 W17） | **P0** |
| 19 | 關 ALLOW_UNSIGNED＋WEBHOOK_TOKEN 出 query | token 改標頭＋定期輪替；正式環境偽造事件一律被拒（解 W13 一半） | **P0** |
| 20 | clasp 部署自動化 | `.clasp.json`＋push 腳本，終結人工貼 5 檔；版本鎖定可回滾，倉庫↔線上不再漂移（解 W16 一半） | P1 |
| 21 | webhook 冪等＋失敗語意修正 | event id 去重表；dispatch 失敗不再吞成 200（回 500 讓 LINE 重送或自建 retry queue）——災時高負載的資料保命符（解 W15） | P1 |
| 22 | LockService＋寫入原子性 | Sheets/RTDB 多筆寫入加鎖與補償邏輯，杜絕部分失敗的不一致狀態 | P1 |
| 23 | 結構化日誌 | logError 升級 JSON（severity/incidentId correlation/引擎版本），故障排查從盲猜變可追 | P2 |
| 24 | 接單 timeout 30 分自動遞補 | GAS 時間觸發器掃 pending assignment，逾時自動遞補並寫稽核（INFO_CHAIN P1 後半） | P1 |
| 25 | 備援代登介面 | 「LINE 掛了怎麼辦」的正面回答：後台代登記報到/安全/叫料（INFO_CHAIN 備援鏈，非選配） | P1 |

### E. 放大「AI 判讀單一接點」（S4＋loaAIAnalyze）

| # | 提升項目 | 做法要點 | 優先 |
|---|---|---|---|
| 26 | 接真生成式 Agent API | loaAIAnalyze 已是單一接點：輸入=結構化回流訊號、輸出=研判＋建議；規則引擎升級為跨事件關聯＋自然語言簡報 | P2〖決策〗 |
| 27 | AI 輸出可追溯 | 每筆研判標「資料來源＋時間戳＋引擎版本」，接 API 後保留 prompt/回應稽核——AI 建議可歸因才敢用 | P2 |
| 28 | 去識別化管線制度化 | 總部搜集區已只用聚合量；把「進 AI 前先匿名」固化成 pipeline＋檢核，守「演練≠實戰」紅線 | P2 |
| 29 | 人在迴路採納流 | AI 建議→幹部一鍵採納→動作＋稽核；「AI 只建議不執行」的授權天花板落成程式行為 | P2 |

### F. 放大「治理文件成熟度＋測試保護網」（S25–S30）

| # | 提升項目 | 做法要點 | 優先 |
|---|---|---|---|
| 30 | CI 上線（GitHub Actions） | push/PR 自動跑 15＋26 組測試＋div 開關配對檢查（errors.md 教訓）＋Playwright 冒煙——把「測試全綠」從自律變守門，成本極低 | **P0** |
| 31 | main 保護＋review gate | 修 FABLE_HANDOFF 自點名的「自動 merge 無審查」風險：main 設保護分支，個資相關改動強制 review | P1〖決策〗 |
| 32 | SECURITY_APPROVAL 補填＋完成簽核 | 主機位置/備份頻率/管理員/緊急聯絡補齊，三個簽署欄簽核生效——唯一法遵文件從紙面變效力 | **P0**〖決策〗 |
| 33 | 22 ACTION API 契約文件版本化 | 單一權威 schema（動作/欄位/範例），前端、GAS、兩份測試四方同源，杜絕契約靠 mock 對齊 | P1 |
| 34 | 角色詞彙統一 glossary | 儀表板 6 角色／LOA 6 角色／AUTH_MATRIX 8 角色三套詞彙做正式映射表（F3），含慈濟用語對照 | P1 |
| 35 | 工作坊 A/B 實際排期 | 兩場無前置可先辦：修繕評估標準化＋財務授權矩陣逐格確認——把零真實回饋（W25）變第一手輸入，AUTH_MATRIX §9 八項待確認當天填 | **P0**〖決策〗 |
| 36 | 使用者手冊＋幹部 SOP | 隨工作坊 C 演練產出（截圖走流程），目前終端使用者文件完全缺席 | P2 |
| 37 | SETUP.md 與 ARCH.md 對帳修正 | SETUP.md 測試數過時（宣稱 13/21 實為 15/26）、ARCH.md 行號全錯——文件自動對帳腳本（函式名 grep 驗證）納入 CI | P1 |

### G. 放大「自我文件化＋內嵌活架構圖」（S31/S32）

| # | 提升項目 | 做法要點 | 優先 |
|---|---|---|---|
| 38 | v1/v2 心智圖引擎抽共用 | 90% 重複引擎合一份（DATA 與 id 前綴參數化），CSS 半鏡像合併；順手修 v2 健檢徽章 id bug（arch2-hb-）、統一 v4/v5/v6 版號 | P1 |
| 39 | 清死碼第三套架構表述 | 刪 app.js 內無人呼叫的 ARCH_DOC renderer/renderArchGraph（#node-detail/#codegen 死 selector 一併清），只留「現況 v1＋願景 v2」兩套 | P1 |
| 40 | 健檢視角接真狀態 | HEALTH 手寫節點狀態 → 由 NAV_MODULES/測試結果半自動生成，架構圖不再與程式脫節，永遠是「活的」 | P2 |
| 41 | INTAKE1 回饋閉環接回主 app | intake.html 現為完全孤島；admin 加「回饋解碼彙整」頁，工作坊回饋碼直接進系統歸檔 | P2 |

### H. 放大「前端工程紀律＋適老定位」（S6/S12/S16）

| # | 提升項目 | 做法要點 | 優先 |
|---|---|---|---|
| 42 | esc() 全覆蓋審計＋單一跳脫函式 | 169 處 innerHTML 逐一審計（尤其屬性情境 value="..."）；esc/escHtml 合併為一，立紀律：動態插值一律過 esc（解 W4） | P1 |
| 43 | a11y 基線＋適老介面規範 | index.html aria 0 處與「志工年齡層偏高」定位直接衝突：補 aria/焦點導覽/對比與字級開關——把 S6 的角色收斂哲學延伸到介面可用性 | P2 |

**（另三項工程底盤，屬「解除優勢阻礙」）**

| # | 提升項目 | 做法要點 | 優先 |
|---|---|---|---|
| 44 | 舊頁清除 | case_mgt/care_rec/rebuild 空殼別名頁下架（依 errors.md 教訓先驗 div 開關配對），資訊架構收斂回 persons | P1 |
| 45 | 計時器生命週期治理 | showPage 進出掛統一 setup/teardown；rtCheckFatigue 永不清理、stopRegPolling 從未呼叫一併修（解 W6） | P1 |
| 46 | app.js 漸進拆檔 | 依 ARCH.md 既定拆分目標分階段抽離（先 DATA 種子、LOA 模組、persons 模組），配合 CI 冒煙防回歸；不追求一次重寫 | P2–P3 |

> 附註（P0 低成本高槓桿）：**demo 資料打標**——儀表板硬編碼 KPI 與 7 處 Math.random 偽即時全部加「示意資料」徽章，展示與真實分離。這放大的是平台最稀缺的「誠實文化」優勢（WORKSHOP_DECK_REVISION 的「自己先講現況」），也直接防 IT 幹部反殺。列為第 **47** 項。

---

## 五、優先路徑總覽

| 波次 | 項目 | 性質 |
|---|---|---|
| **P0（立即，多為決策＋低成本）** | #17 部署落地〖決策〗、#18 Firebase 規則、#19 關 ALLOW_UNSIGNED、#30 CI、#32 法遵簽核〖決策〗、#35 工作坊 A/B 排期〖決策〗、#47 demo 打標 | 把「已寫好」變「真的上線」＋守門 |
| **P1（1 個月）** | #1 KPI 留存、#4 統一稽核、#5 schema 版本、#7 drill 隔離、#12/#13 去 CDN、#15 saveData、#20 clasp、#21 冪等、#22 鎖、#24 timeout 遞補、#25 備援代登、#31 review gate、#33 API 契約、#34 glossary、#37 文件對帳、#38/#39 心智圖合併清死碼、#42 esc 審計、#44 舊頁、#45 計時器 | 資訊流閉環真實化＋工程底盤 |
| **P2（2–3 個月）** | #2 演練劇本、#3 泳道圖、#6 覆蓋率、#8 交接快照、#9 矩陣編輯器、#10 平時黏著、#11 複盤精靈、#14 PWA、#16 韌性包、#23 結構化日誌、#26–#29 AI 升級〖決策〗、#36 手冊、#40 健檢接真、#41 回饋閉環、#43 a11y | 血緣飛輪＋AI＋體驗 |
| **P3（3–6 個月＋）** | #46 拆檔完成；多站協作/Squad schema/政府 API（GROWTH_ROADMAP Phase 3–4 既列） | 規模化與韌性 |

**一句話**：這個平台最稀缺的三樣資產是「incidentId 血緣溯源、平戰一體狀態機、遠超原型水準的治理文件」；91 項提升裡最高槓桿的一步是 **#17 Phase 0 部署**（讓所有已寫好的優勢變現）＋ **#30 CI**（讓 41 組綠燈測試變守門），而 **#32/#35 兩個決策項**（法遵簽核、工作坊排期）不拍板，其餘各項的價值都會折半。

---

## 六、第二輪追加提升清單（#48–#91，2026-07-13）

> 第一輪走大架構層；第二輪深掘 11 個業務模組與 12 個橫切技術面向，聚焦「**現場真的有人用時**會先撞到的牆」。編號接續第一輪；與第一輪相關者標互參。

### I. 現場操作體驗——行動裝置與輸入（放大 S6 適老定位、S14 展示力）

| # | 提升項目 | 做法要點（含證據） | 優先 |
|---|---|---|---|
| 48 | `prompt()` 全面替換為行內表單/modal | 關鍵流程用桌機時代的 prompt() 收值，手機體驗差且無法優雅取消：驗收數量 app.js:9524、歸還損壞數 1676、報廢原因 1836、分類規則 2027-2029、角色管理 6474-6476——救災現場主力裝置是手機 | P1 |
| 49 | 破壞性操作統一確認＋undo 框架 | 全系統僅 11 處 confirm；個案結案 8855（不可逆）、慰問金核發 9552（財務）、報廢、刪自動分類規則 2035、儀表板四類 splice 刪除（4527/4563/4603/4671）全無確認無 undo。建統一 confirmAction()＋「已刪除，復原」toast | P1 |
| 50 | 表單驗證框架（欄位級行內提示） | 全 codebase 幾乎無 required/pattern（唯 2 命中皆誤判 app.js:2176）；電話 09 開頭 10 碼、身分證檢核碼、email regex（Gmail 設定 5369 僅判非空）、日期選擇器（資產預計歸還是自由文字 1324）；錯誤顯示改紅框＋aria-invalid，取代全域 toast 1224 | P1 |
| 51 | 個案狀態機補「退階/更正」路徑 | CASE_TRANSITIONS 只允許前進（app.js:8843），誤分類無退路；補授權保護的更正流程並寫 timeline 稽核 | P1 |
| 52 | 相機掃 QR 報到 | 全檔無 getUserMedia/BarcodeDetector/jsQR，掃碼依賴外部 LINE LIFF（5914）；補瀏覽器原生掃碼＝離線也能報到（放大 S10 離線優先） | P2 |
| 53 | GPS 定位打卡 | 全檔 0 個 navigator.geolocation，「GPS 已附帶」「GPS驗證」是硬編碼假字串（1125/8094/8150）；報到與照片回報附真座標，接 KPI 到位率 | P2 |
| 54 | 照片上傳前壓縮＋EXIF 萃取 | previewPhotoFile 用 FileReader 直塞 dataURL 無 canvas resize（2043-2045）；災區弱網傳原圖必失敗；順帶萃取 EXIF 時間/方位入 metadata | P2 |

### J. 資料尋找性——搜尋/篩選/分頁（資料量一大就是牆）

| # | 提升項目 | 做法要點（含證據） | 優先 |
|---|---|---|---|
| 55 | 長表統一搜尋/篩選/排序元件 | 個案名單 8713、社區名冊（可 200+ 筆）5970、求助收件匣 8241、任務池 900、收容所 9424、整理站三表、照片庫 1971、系統日誌 7441 全部只能捲動；做一個共用 tableTools() 全面掛上 | P1 |
| 56 | `slice(0,N)` 硬截斷改分頁/載入更多 | 超出筆數靜默隱藏：任務池 slice(0,8) 932、未回報 slice(0,6) 372、情資 feed slice(0,7) 2363、緊急頁 slice(0,3) 2820-2888——災時漏看第 9 筆任務是事故 | P1 |
| 57 | 全域搜尋（omnibox）＋鍵盤快捷鍵 | 全檔 0 個 keydown 綁定、無跨模組搜尋；幹部要找「王老太太的案子」得先猜在哪一頁 | P2 |
| 58 | vol_hub 假搜尋框接真＋批次報到 | 「志工管理與指派」搜尋框與組別篩選無 id/oninput（index.html:469-477），下方是三筆寫死假資料；名冊無批次報到 | P1 |
| 59 | 重複偵測自動化 | 重複通報靠預設 r.dup 旗標（8231）非即時比對；新進通報依電話/位置/時間視窗自動標可疑重複；報名重複人員同理（放大 S3 KPI 正確性） | P1 |

### K. 通知與即時性（SOS 不能靠盯螢幕）

| # | 提升項目 | 做法要點（含證據） | 優先 |
|---|---|---|---|
| 60 | 瀏覽器 Notification API | 全檔 0 個 Notification；SOS 僅同分頁 DOM overlay＋beep（499-526），分頁在背景/最小化即無感——總控沒開著那一頁就漏接 SOS | P1 |
| 61 | SOS 震動與聲音持續策略 | navigator.vibrate 只出現在 API 測試頁（6809），SOS 路徑無震動；beep 一響即止，改持續至確認 | P1 |
| 62 | 逾期/催辦一鍵推播 | 資產逾期未還只顯示文字「建議推播催還」（1645）無按鈕；接 GAS push 一鍵催還/催辦（Phase 0 部署後） | P1 |

### L. Render 效能架構（放大 S9 零依賴的可維護性）

| # | 提升項目 | 做法要點（含證據） | 優先 |
|---|---|---|---|
| 63 | 局部更新推廣 | renderSingleStat 局部更新模式（4265）是好範本，但多數 mutator 走整批 renderAll 全量重建（4424）＋163 處 innerHTML= 整段覆蓋；高頻動作（派工/回報）改局部 | P2 |
| 64 | 計時器可見性暫停 | 僅報名輪詢有 document.hidden gating（9642-9645）；syncTimer/countdownTimer/rtCheckFatigue/_wsbTimer（7288/7340/9647/9778）背景分頁照跑——省電省配額（互參 #45 生命週期清理） | P1 |
| 65 | fetch 全面 AbortController＋指數退避 | 9 處 fetch 0 個 AbortController，慢回應無限掛起；fetchRegCount 失敗僅計數仍固定 30s 續打（4268-4274）；USGS 已有 TTL 快取但 retry 無 timeout（2229-2244） | P1 |
| 66 | 非當前頁 DOM 延遲初始化 | 21 頁全常駐 DOM 只切 .act class（5217-5219），背景頁的大表格照樣吃 reflow；首訪才 render、離頁可卸載 | P2 |

### M. GIS 與動線（工作坊核心痛點的正面解）

| # | 提升項目 | 做法要點（含證據） | 優先 |
|---|---|---|---|
| 67 | 家訪動線規劃真實化 | 「🗺 動線規劃面板」兩處都是 toast 假按鈕（8772/9101），而「150+ 條家訪動線靠人腦記」正是工作坊列的第一線痛點；最小可行：個案地址標點→順路分組→動線清單→指派訪視員 | P2 |
| 68 | 儀表板假地圖與 monitor 真圖統一 | 儀表板是 CSS 格線＋emoji 圖釘（4335-4345），monitor 才是真 Leaflet（2179）；抽單例地圖元件兩頁複用，點擊可定位 | P2 |
| 69 | 標記聚合＋離線圖磚 | 只用 L.circleMarker 無 markercluster（2195-2257），多站點重疊；tile 走線上 CartoDB（2180）斷網即空白——離線圖磚快取是「離線優先」的最後一塊（互參 #12） | P2 |
| 70 | 地址→座標 geocoding | 全檔無 geocoding；通報/個案地址無法自動上圖，靠手點；GAS 代理或離線鄉鎮中心點對照表 | P2 |

### N. 報表匯出與對外對接（財務/政府要的是檔案）

| # | 提升項目 | 做法要點（含證據） | 優先 |
|---|---|---|---|
| 71 | CSV 匯出：名冊/核銷帳/物資單/KPI | 全檔無 CSV 產生；app.js:317 自承「實際部署後可匯出 CSV」目前只是 toast；核銷對財務、名冊對造冊、KPI 對督導都需要檔案 | P1 |
| 72 | 列印樣式接線 | @media print 是孤兒 CSS：data-print-time 無人設定、0 個 window.print()（style.css:626-637）；且 print CSS 強制所有頁 display:block（631）＝一次印 21 頁；修 scope＋加列印按鈕 | P2 |
| 73 | 結案報告人可讀版 | 個案封存故事線已有 JSON 匯出（1575-1579），補一鍵產出 HTML/PDF 給家屬簽收與內部歸檔（放大 S2 血緣） | P2 |

### O. 時間與在地化（資料品質的隱形地基）

| # | 提升項目 | 做法要點（含證據） | 優先 |
|---|---|---|---|
| 74 | 時間戳統一 ISO/epoch 存儲 | _parseAnyTs 要容錯三種格式（4948-4951）本身就是症狀；借還存 'MM-DD HH:MM' 顯示字串（1369/1673）、timeline.ts 格式參差（8985 vs 8618）；存儲一律 epoch、顯示一律 fmtTS（KPI 正確性的地基，互參 #5） | P1 |
| 75 | 強制 Asia/Taipei 時區 | 大量 toLocaleString 無 timeZone 參數（495/563/1439），跨時區裝置顯示不一致；GAS 端另有自己時區 | P2 |
| 76 | 民國年顯示選項 | 全檔無民國年轉換；長者志工日常用民國年、公文對接也是（5537 出生年月日標「西元」）；顯示層加西元/民國切換 | P2 |
| 77 | 併發寫入 lost-update 防護 | BroadcastChannel onmessage 註解宣稱 field-by-field merge 實際只 notifyAll() 重讀（4885-4896）；兩分頁同時改同筆仍互相蓋寫；補欄位級 merge 或版本號檢查 | P2 |
| 78 | session timeout/閒置登出 | drms_current_user 無任何 expiry（5-8），唯一 TTL 是破窗提權 30 秒（7408）；共用平板場景（服務台輪班）需閒置自動登出（放大 S13 權限模型） | P1 |
| 79 | 系統日誌升級 | 無等級/模組篩選、無搜尋、無匯出、僅留 50 筆即 pop（7441/9853）；災後究責與除錯都靠它——加篩選＋匯出＋保留量設定（互參 #4 統一稽核） | P1 |

### P. 假功能收斂——誠實化二期（放大 S28 誠實文化，互參 #47）

| # | 提升項目 | 做法要點（含證據） | 優先 |
|---|---|---|---|
| 80 | toast 假按鈕清單化處理 | 「＋申請大車調度」9406、「＋登錄外部單位」8454、「動線規劃」8772/9101、syncRegistry 同步表單 stub（6026-6029）——逐一「實作 or 明標規劃中」，工作坊演示時被點到就是信任事故 | **P0** |
| 81 | monitor 假 LIVE 修正 | 氣象警特報硬編碼三筆卻掛 LIVE 標籤（2470-2488/2322）；CCTV 是 emoji 假畫面＋假閃燈（2416-2443）——改接 CWA opendata（有免費 API）或明標「示意」 | **P0** |
| 82 | relief_req 填報表單接真 | 表單的位置/人數/電話欄位完全未被讀取，送出鈕呼叫 reliefSimSubmit 產生隨機資料（8344-8356）——欄位是裝飾；改讀真欄位進收件匣 | P1 |
| 83 | 警報人數接真實資料 | rtFireAlert 硬編碼「142 位志工」（1626-1628）非實際在場人數；從報到資料即時計算 | **P0** |

### Q. 業務模組深化（放大各模組既有狀態機）

| # | 提升項目 | 做法要點（含證據） | 優先 |
|---|---|---|---|
| 84 | 收容所進出登記 | currentOccupancy 是靜態數字（9427），無收容者 check-in/out；占用率即時化才能支撐調度決策 | P2 |
| 85 | 核銷金額合理性驗證＋財務動作雙確認 | 物財核銷估值僅檢查 <0（8543/8611），可輸入超額估值影響金額分級判斷；慰問金核發無確認（9552）——財務動作一律確認＋上限檢查（放大五步審核鏈 SoD） | P1 |
| 86 | PII 遮蔽一致性審計 | maskPII 已存在（2151/8959）但求助收件匣電話明文（8246）、協調夥伴電話明文（8447）、報名暫存明文（5825）——盤出所有 PII 顯示點統一過遮蔽（放大 S13，互參 #42） | P1 |
| 87 | 適老視覺三件套 | 字級調整（body 固定 13px，style.css:32 無縮放控制）、高對比模式（無 prefers-contrast）、跟隨系統主題（9704 手動 toggle 無 prefers-color-scheme）——「志工年齡層偏高」定位的介面落地（互參 #43） | P1 |
| 88 | 串接設定欄位驗證 | Gmail 群組 email 僅判非空（5369-5373）、LINE Token 無格式檢查（5386-5393）；打錯一個字元推播全掛且無診斷線索——加格式驗證＋「測試連線」鈕 | P2 |
| 89 | GAS 名冊查詢加 CacheService | findInnerMember/findVolunteer 每次訊息都 getDataRange().getValues() 全表載入線性掃（handlers.gs:520-536）；名冊千人級時逐訊息全表掃描撞配額——CacheService 快取＋TTL | P1 |
| 90 | LINE multicast 批次推播 | 廣播/點名對名單 for-loop 逐人 push（webhook.gs:142/149），142 人＝142 次 UrlFetchApp，恐撞 GAS 6 分鐘上限與 LINE 限流；改 multicast API（單次 500 人）（放大 S21 成本紀律） | P1 |
| 91 | 新手導覽與說明系統 | 全檔無 tour/onboard/guide，僅原生 title tooltip（890-893）；對年齡層偏高的志工，首次開啟的 3 分鐘導覽＋每頁「這頁做什麼」說明是採用率關鍵（放大 S6） | P2 |

### 第二輪波次歸位

- **P0 追加**：#80、#81、#83（假功能誠實化——工作坊/IT 簡報前必做，成本極低）。
- **P1 追加**（隨 Phase 0–1 一起做）：輸入與防護 #48–#51、尋找性 #55/#56/#58/#59、通知 #60–#62、網路 #64/#65、匯出 #71、時間 #74、帳號 #78/#79、業務 #82/#85/#86/#87/#89/#90。
- **P2 追加**（Phase 2 體驗躍升波）：裝置能力 #52–#54、全域搜尋 #57、效能 #63/#66、GIS #67–#70、報表 #72/#73、在地化 #75–#77、其餘 #84/#88/#91。

---

## 七、證據索引

- 前端掃描：app.js（9,897 行實測）／index.html／style.css／intake.html
- 後端掃描：gas/*.gs 5 檔＋SETUP.md；test_gas_handlers.js（G1–G15）＋test_loa_integration.js（T1–T26）本次實跑 exit 0
- 文件掃描：FABLE_HANDOFF／GROWTH_ROADMAP／INFO_CHAIN_ADOPTION／LOA_INTEGRATION_REVIEW／LOA_ROLES_SPEC／SECURITY_APPROVAL／AUTH_MATRIX_SPEC／ARCH_V2_SPEC／TODO_WORKSHOP／WORKSHOP_0406/B/C/D/E／WORKSHOP_DECK_REVISION
- 架構圖掃描：arch-script.js（662 行/30 節點）／arch-script-v2.js（440 行/14 節點）／arch-style.css
- 前次稽核：SYSTEM_AUDIT_2026-07-09.md（F 編號資安項與未修清單沿用其編號）
- 第二輪深掘（2026-07-13）：11 個業務模組逐頁 UX 掃描（dashboard/monitor/vol_hub/warehouse+sorting+assets/shelter_mgt/relief_req/coord/persons/drive/rtsync+line_oa/admin）＋12 個橫切技術面向（render/輪詢/通知/GIS/協作/行動裝置/報表/驗證/onboarding/GAS 深化/時間/主題），量化：163 處 innerHTML= 指派、11 處 confirm、0 個 Notification/geolocation/getUserMedia/AbortController/keydown、0 個 CSV 產生、@media print 孤兒樣式
