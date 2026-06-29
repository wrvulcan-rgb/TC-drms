(function(){
var root=document.getElementById('arch2-root');
// ── 場域（背景色塊，非框）──
var ZONES=[
  {cls:'tzu', lbl:'慈濟基金會 · 指揮', x:2,  y:8,  w:44, h:84},
  {cls:'vol', lbl:'志工端 · 前線',     x:54, y:4,  w:44, h:42},
  {cls:'ppl', lbl:'鄉親端 · 受助',     x:54, y:48, w:30, h:30},
  {cls:'gov', lbl:'政府',             x:88, y:50, w:10, h:26},
  {cls:'back',lbl:'後端服務層',         x:30, y:82, w:44, h:15}
  ,{cls:'field', lbl:'現場指揮層 · 班組/梯次', x:46, y:4, w:52, h:40}
];

// ── 節點：rtsync 鎖中央(50,50)，放射環繞 ──
var NODES=[
  // 上方=發起/啟動（時間軸上緣）
  {id:'drill',    nm:'平時演練', ico:'\uD83C\uDFAF', x:14, y:14, status:'live', kind:'trigger', trigger:true,
    script:'救災能力不是天生的，是練出來的。我設計這個模組的出發點很簡單：如果只有真實災害才能操作系統，那志工第一次用就是最緊張的時候，這不合理。平時演練讓整個系統在沒有壓力的情境下被完整走過一遍，幹部熟悉派工流程、志工熟悉報到步驟、後勤熟悉物資調度。它的用處是：定期載入不同災型劇本，讓每一個角色都知道自己在真實災害中該做什麼。未來會加入自動排程，讓演練成為常態，而不是臨時想起來才做。',
    desc:'平時模式啟動源。排程或手動發起演練，載入情境劇本，進入儀表板平時模式。'},
  {id:'activate', nm:'戰時啟動', ico:'\uD83D\uDEA8', x:30, y:9,  status:'live', kind:'trigger', trigger:true,
    script:'我把戰時啟動設計為「現場發動，不等上面」。傳統模式是等待指揮部下令，但災害現場的狀況往往是第一線志工先知道。讓當區志工能在手機上觸發啟動，系統就立刻切換到戰時模式、依災害類型自動開關對應模組，省去手動設定的時間。這背後的理念是：反應速度本身就是救援能力，每一分鐘都可能影響一個家庭能不能得到幫助。未來計劃加入 LINE 推播通知，讓整個指揮鏈在觸發的同一時間就都知道。',
    desc:'戰時模式啟動源。當區志工觸發，系統切戰時，依災型/受災等級動態開關模組，進入儀表板。'},
  {id:'dashboard',nm:'總控儀表板', ico:'\uD83D\uDCCA', x:34, y:24, status:'live', kind:'core',
    script:'設計這個儀表板的核心想法是：高層不應該靠人回報才知道現場狀況。在傳統救災模式裡，指揮官需要打電話、問現場、等資料彙整，這個過程本身就是延誤。總控儀表板讓受災戶數、撤離人數、志工到位率、物資完成率在同一個畫面即時呈現，平時演練和戰時啟動都從這裡進入。它的用處不只是「看數字」，更是讓幹部在正確的資訊下做決策——支援哪裡、加派哪裡、哪條線卡住了。可編輯版面讓不同單位依自己需要調整看板，AI 戰術分析模組（規劃中）未來會在這裡提供調度建議。',
    desc:'高層/總控專用。系統起點：平時演練與戰時啟動兩條線都回到此。KPI、情境模擬(10災型)、戰時派遣、可編輯版面、AI 戰術分析。'},

  // 左=慈濟指揮
  {id:'staff',    nm:'幹部/高層', ico:'\uD83D\uDC54', x:13, y:32, status:'live', kind:'actor',
    script:'指揮端設計的基本原則是「角色決定視野」。同樣的系統，幹部看到的模組、能執行的操作，和高層、總控不同。這樣設計是因為資訊過多反而造成干擾——高層需要的是全局 KPI，現場幹部需要的是任務細節，讓他們看到同一個畫面只會互相打架。這個角色分層也是資安的基礎：不同角色的操作邊界清楚，就能防止誤操作或越權。目前角色判斷在前端執行，計劃移到後端驗證以提升安全性。',
    desc:'慈濟指揮端(Web 後台)。幹部、總控、高層，依角色不同權限與可見模組。'},
  {id:'monitor',  nm:'全域監控', ico:'\uD83D\uDDA5\uFE0F', x:11, y:54, status:'live', kind:'core',
    script:'全域監控是「只看不碰」的設計。我把它獨立出來，是因為在指揮中心裡，投影在大屏上的畫面不能是會被人亂按的操作介面。它彙整情資、前線需求、即時影像、外部連線狀態，專門為簡報、對外說明、和高層決策設計。它從調度中台唯讀拉取資料，不回寫，確保現場操作不受干擾。目前考慮將它與總控儀表板的「簡報模式」整合，讓一個系統切換模式，而非維護兩個介面。',
    desc:'高層唯讀決策視圖：情資彙整、前線需求、即時影像、外部連線狀態。不涉操作。'},
  {id:'reg',      nm:'報名報到', ico:'\uD83D\uDCCB', x:14, y:73, status:'live', kind:'core',
    script:'報名報到解決的是一個很現實的問題：志工到場了，但幹部不知道誰來了、能派誰。以前靠人工點名或紙本，資料傳遞慢且容易遺漏。這個模組讓志工在 Line OA 自助完成報到，資料自動進入幹部端名冊，再進入調度中台成為可派人力——全程不需要幹部手動輸入。雙軌設計（今日報到 + 明日預約報名）是因為大型災害往往需要提前部署，讓幹部能提前掌握明天的人力庫存。',
    desc:'幹部端報到管理視圖。Line OA 報到資料寫入名冊，供調度派工。今日報到+明日報名雙軌。'},
  {id:'sheet_reg',nm:'報名資料總表', ico:'\uD83D\uDCD1', x:28, y:68, status:'partial', kind:'core',
    script:'這個模組的設計初衷是讓報名資料有一個「主表」。慈誠委員和社區志工的名冊散落在不同地方時，派工會出現重複或遺漏。報名資料總表對接 Google Sheets，讓所有資料集中在一個地方，任何更動都即時反映。後端程式（GAS）已建好，目前只差設定 /exec 網址就能上線——這個「最後一步」之所以先暫停，是在等確認使用的 Sheets 欄位格式定案後再接，避免後續反覆修改。接好後這裡會成為所有報名相關功能的資料源頭。',
    desc:'幹部端 Sheets 報名管理(慈誠委員+社區志工)。GAS 後端已建，需設定 /exec 網址。'},
  {id:'vms',      nm:'志工管理', ico:'\uD83D\uDC65', x:27, y:42, status:'live', kind:'core',
    script:'志工管理解決的是調度的基礎問題：你必須先知道有誰、他們能做什麼，才能做出有意義的派工決定。這個模組管理每位志工的技能、聯絡方式、歷史任務紀錄，讓幹部在派工時有依據，而不是靠記憶或直覺。指派結果直接進入調度中台，讓「決定誰去」和「通知他去哪」之間沒有斷點。未來計劃和報到系統整合，讓「人到場」和「人可被派」這兩件事自動連動。',
    desc:'人員資料、任務指派、報告。指派結果進調度中台。'},
  {id:'sysadmin', nm:'系統管理層', ico:'\uD83D\uDEE1\uFE0F', x:40, y:58, status:'live', kind:'admin',
    script:'系統管理層是整個平台的「設定中樞」，讓系統本身可以被配置，而不是寫死在程式裡。每個組織的救災需求不同，不同災型需要開不同的模組——這些都應該能在介面上調整，不需要改程式碼。版本備份還原讓誤操作有後路，Gmail/LINE 串接設定讓通訊管道集中管理。這裡也是目前資安最需要加強的地方：權限矩陣目前在前端執行，意味著懂技術的人可以在 console 繞過，這是 P1 待修項目，計劃移到後端驗證。',
    desc:'功能後台(權限矩陣、模組管理)+後台維運(系統設定、Gmail/Line 串接、版本備份還原、戰時災型預設、開發待辦)。權限控管與設定所在地。'},

  // 中央核心
  {id:'rtsync',   nm:'即時調度中台', ico:'\u26A1', x:50, y:50, status:'live', kind:'core', center:true, locked:true,
    script:'我把即時調度中台放在心智圖正中央，不是視覺設計的習慣，而是它真的就是整個系統的核心。在真實救災現場，最常出現的混亂是：這個需求誰負責？這個物資哪裡來？這個志工在哪？這些問題沒有一個統一的入口，就會不斷被詢問、不斷重複協調，浪費時間也容易出錯。調度中台的設計理念是把所有第一線的動作收攏到一個地方——任務建立、派工、物資調度、緊急警報、SOS、點名，全部在同一個介面完成。四個分頁（任務池、任務互動、結案、緊急）對應四種不同的工作節奏，讓幹部不需要在多個系統之間切換。',
    desc:'現場唯一指揮橋樑。4 tab：派任務/看進度(含出貨)/結案/緊急(警報+SOS+點名)。所有派工、調度、叫料媒合在此。'},

  // 右上=志工前線
  {id:'volunteer',nm:'當區志工', ico:'\uD83D\uDC65', x:58, y:12, status:'live', kind:'actor',
    script:'整個系統設計的最終使用者，其實是這群拿著手機在現場服務的志工。他們不會有時間看複雜的介面、等待頁面載入、或輸入大量表單。所以我的設計原則是：志工在 Line OA 完成所有操作，不需要下載 App，不需要登入帳號，手機開 LINE 就能用。戰時啟動、自助報到、收任務通知、叫料回報、照片上傳——每一個動作都盡量縮短到最少步驟。系統好不好用，最終的測試標準就是現場的志工覺不覺得麻煩。',
    desc:'前線志工(手機/Line OA)。戰時觸發啟動、報到入列、現場執行與回報。'},
  {id:'lineoa',   nm:'Line OA', ico:'\uD83D\uDCAC', x:62, y:30, status:'partial', kind:'channel',
    script:'選擇 LINE OA 作為志工介面，是因為它已經是志工日常生活的一部分。要求志工下載 App、記帳號密碼，這個門檻在緊急狀況下會直接讓人放棄。LINE OA 讓系統的操作介面和他們平常聯絡的工具合而為一。目前模擬器已完整實作了報到、三步驟叫料、勘災回報、餐食表單等功能，真實的 LINE Webhook 後端是下一個里程碑——那一步接上後，這個系統就從「展示原型」變成「可以真的用」的工具。個資從這個入口進入，是目前資安需要特別注意的地方。',
    desc:'志工自助報到入口 + 收任務 + 勘災回報 + 叫料輸入/派送通知。模擬器已內嵌，真實 Webhook 待接。'},
  {id:'sorting',  nm:'物資整理站', ico:'\uD83D\uDCE5', x:78, y:14, status:'live', kind:'limb',
    script:'捐贈物資到達現場的時候，往往是混亂的——不同種類、不同狀況、不同包裝全部混在一起。如果直接進倉儲，後續調度時根本無法準確知道手上有什麼。物資整理站是「讓混亂變成庫存」的第一關：拆箱、分類、報廢篩選、重新包裝，每一步都有紀錄。這個流程的設計讓後續的倉儲管理和調度媒合有可靠的資料基礎——你不能調度你不知道自己有的東西。',
    desc:'志工線。收件→拆箱分類→報廢/覆核→重包裝→入庫。一般物資處理起點。'},
  {id:'warehouse',nm:'物資倉儲', ico:'\uD83D\uDCE6', x:90, y:26, status:'live', kind:'limb',
    script:'物資倉儲讓「我們有什麼」這件事變得透明。三級分類造冊讓任何一個幹部打開系統都能立刻知道庫存狀態，不需要問人、不需要靠記憶。對外出貨不由倉儲直接處理，而是統一經過調度中台媒合——這個設計確保物資分配有整體視野，不會出現「甲單位補到飽、乙單位缺貨」的情況。未來計劃接上 Google Sheets 讓造冊資料雲端化，多個站點同時更新不打架。',
    desc:'志工線。三級分類造冊、入庫、發送。一般物資。對外出貨經調度媒合。'},
  {id:'drive',    nm:'照片回報分類', ico:'\uD83D\uDCF7', x:70, y:44, status:'partial', kind:'limb',
    script:'現場照片是救災紀錄最重要的一部分，但如果照片散落在每個人的手機裡，事後要整理、對帳、或對外說明時會非常困難。照片回報分類讓志工直接在 LINE 上傳照片，系統自動對應個案和任務、歸類到 Google Drive 正確的資料夾。前端分類流程已完成，目前等待 Google Drive API 金鑰設定完成後就能接上。接好後，每一場救災的影像紀錄都會自動整理完畢，不再需要事後手動分類。',
    desc:'Line OA 回傳照片→Drive→自動分類。前端流程完成，Drive API 待設定。'},

  // 右中=鄉親受助
  {id:'fieldgroup',nm:'L3 現場群', ico:'\uD83C\uDFD5\uFE0F', x:66, y:62, status:'live', kind:'limb', center:false,
    script:'L3 現場群是整個系統最靠近鄉親的地方，也是我設計這套系統最核心的初衷。前面所有的調度、派工、物資管理，最終目的都是讓這一段——安置收容、個案管理、關懷紀錄、安心祝福金發放——能夠順暢進行。它把四個面向整合在同一個群組裡，讓志工在現場服務時不需要在多個介面之間切換。安心祝福金併入關懷紀錄發放，是因為金錢援助和關懷探訪本來就是同一個服務流程，不應該被切開記錄。個案資料含有個資，目前是未加密狀態，這是最優先要處理的資安問題。',
    desc:'服務鄉親的現場執行群(志工操作、鄉親受助)。安心祝福金併於關懷紀錄發放。',
    subs:['安置收容管理','個案管理系統','關懷行動紀錄(含安心祝福金)','慈濟資產調度']},

  // 政府(縮小)
  {id:'emic',     nm:'政府 EMIC', ico:'\uD83C\uDFDB\uFE0F', x:93, y:60, status:'planned', kind:'future', mini:true,
    script:'政府 EMIC（消防署災害應變系統）的節點先放在這裡，是一個方向性的預留，不是近期實作目標。設計理念是：慈濟的救災行動不應該和政府的調度脫節，雙向交換災情與資源資料，可以讓兩個體系的行動互相補位而不是重複。目前這個整合的技術和行政條件都還沒到位，先在架構圖上標示出來，讓所有人知道這是我們想要走到的地方。等條件成熟，從全域監控開始對接是最自然的切入點。',
    desc:'消防署災害應變系統。未來與全域監控雙向交換災情/資源，尚未規劃實作。'},

  // 下=結案歸檔 + 後端服務層
  {id:'story',    nm:'故事線結案', ico:'\uD83D\uDCD6', x:55, y:74, status:'live', kind:'core',
    script:'故事線結案解決的是一個長期被忽視的問題：每一場救災結束後，我們做了什麼、為什麼這樣做、哪裡出了問題，這些經驗往往散落在個人記憶和零散紀錄裡，下一次很難傳承。故事線結案從稽核日誌自動串出時間軸敘事，讓整個救災過程有完整的、可查閱的紀錄。它同時有兩個用途：對外說明（給捐助人、政府、媒體看到我們做了什麼）和對內傳承（把這場救災的經驗匯出成演練劇本，讓下一次更好）。每一場救災都應該讓組織更有能力，而不是結束後歸零。',
    desc:'結案讀 audit log 串時間軸敘事，含 session 場次/錯誤聚合/UX 卡頓遙測。匯出 JSON 當演練劇本。'},
  {id:'backend',  nm:'後端服務層', ico:'\uD83D\uDDC4\uFE0F', x:50, y:89, status:'partial', kind:'backend',
    script:'後端服務層的設計是分三個階段走，而不是一開始就上最複雜的架構。第一階段：localStorage，讓系統在沒有網路的現場也能運作，所有狀態存在本機，連線後再上傳。這是最務實的選擇，因為災區網路不穩定是常態。第二階段：Google Sheets + GAS，讓報名和個案資料有雲端備份，幹部能從任何電腦查閱。第三階段：Firebase RTDB，支援多個站點的幹部同時操作、即時看到同一份資料，介面已預留，等需求確認後啟用。最需要立即處理的問題是：志工的身分證號、電話等個資目前明文存放在 localStorage 和 Sheets，僅靠前端遮蔽，沒有加密。這是 P1 最高優先的資安待修項。',
    desc:'資料存放與同步層。點開看子項：本機儲存、雲端後端、即時同步。',
    subs:['localStorage（本機資料/版本備份/場次/遙測，離線可用）','GAS + Sheets（報名/個案後端，待設定 /exec）','Firebase RTDB（多人共編，規劃中）']}

  /* ── 現場指揮層：班長制核心 ── */
  ,{id:'squad', nm:'班組管理', ico:'🪖', x:60, y:18, status:'planned', kind:'core',
    script:'班組是這次架構強化的最核心新增。原有系統的任務分到「人名」，但慈濟真實出班是以「班組」為單位：班長帶 5-10 人，統一接單、統一執行、統一回報。班組管理建立三層指揮鏈（總指揮→區隊長→班長→班員），讓每一筆人力都知道自己屬於哪個班、班屬於哪個梯次、梯次屬於哪個區域。這是所有後續功能（任務池、梯次排班、作戰指揮圖）的資料地基，不建就全卡。',
    desc:'三層指揮鏈。DATA.squads：班長/班員/配屬車輛/責任區/梯次/狀態/技能標籤。志工報到後自動歸隊，班長手機即時看到本班人數。'}
  ,{id:'taskpool', nm:'任務池', ico:'📋', x:75, y:22, status:'planned', kind:'core',
    script:'任務池是 Uber 接案模式的實體。HQ 建立任務後進入池中，班長手機依「距離/技能/容量」排序看到最適合自己的任務，一鍵接單。三種模式可切換：自由搶單（資源充足時）、HQ 指派（緊急任務）、智慧媒合（系統推薦，班長確認）。關鍵設計：指派優先，15 分鐘無人接才開放搶單；隱藏搶單競爭數字，避免慈濟文化排斥競爭感。接單後自動推播給所有班員。',
    desc:'Uber 接案介面。Task 含：類型/地點GPS/所需技能/優先級P0-P3/狀態/接單班組/完成照片。班長一鍵接，班員自動收 LINE 推播。'}
  ,{id:'tier', nm:'梯次排班', ico:'📅', x:58, y:32, status:'planned', kind:'core',
    script:'梯次是慈濟出班的基本單位，但原有系統沒有這個概念。梯次排班模組讓幹部在出班前排好「誰幾點去哪、開哪台車、集合在哪」。DATA.tiers 綁定班組+車輛+集合點+帶隊幹部，確認後推播給所有班長。系統同時檢查：每班是否有配屬車輛？若缺車，自動從可用車輛池建議配對。類 Google Calendar 時間軸 UI，班組用色塊標示，可拖移調整。',
    desc:'梯次三要素：時間/班組/車輛。確認後推播班長。系統自動檢查車輛缺口並建議配對。'}
  ,{id:'cmdmap', nm:'作戰指揮圖', ico:'🗺️', x:72, y:34, status:'planned', kind:'core',
    script:'HQ 需要一個畫面同時看到「所有班現在在哪、做什麼、狀態如何」。作戰指揮圖在地圖底圖上疊加班組色塊（待命/執行中/移動中/SOS）、任務熱力圖（紅黃綠點）和人力空白區警示。當某班觸發 SOS，系統自動建議「最近待命班→支援」，HQ 一鍵確認即觸發雙邊通知。這個頁面是給指揮官看的，不是給志工用的。',
    desc:'地圖底圖 + 班組即時狀態色塊 + 任務熱力圖。人力空白區自動警示。一鍵增援觸發雙邊 LINE 通知。'}
  ,{id:'handover', nm:'交接日誌', ico:'🤝', x:60, y:46, status:'planned', kind:'core',
    script:'梯次交接一直靠 LINE 群口頭交接，資訊大量流失。交接日誌在收班時自動從系統抓取快照：未完成任務（附進度和現場備注）、物資差異（借出 vs 歸還 diff）、待追蹤紅標個案、現場安全狀況。班長只需確認並填補空白欄位，不從零開始打字。交接記錄存檔不可修改，並推播給下梯所有班長。每梯次收班強制走完此流程。',
    desc:'收班強制流程。系統自動生成快照：未完任務/物資差異/待追個案/現場安全。班長確認→推播下梯→不可修改存檔。'}
  ,{id:'relief_ledger', nm:'金援帳本', ico:'💰', x:76, y:46, status:'planned', kind:'core',
    script:'慈濟現金發放缺乏完整簽收鏈，是公信力風險。金援帳本建立嚴格的發放流程：從個案自動帶入受災戶資訊（不允許手動輸入對象）→身份確認→雙人見證→受災戶手機簽名→存證照（含時間戳浮水印）→寫入不可刪除帳本。自動 Gmail 給財務組（附 PDF）。月底自動生成發放總表 CSV 供對帳。同一個案再次發放需幹部額外授權。',
    desc:'發放五步驟：身份確認→金額→受災戶簽名→雙人見證→存證照。不可刪帳本。Gmail 自動推財務。月報 CSV 匯出。'}
  ,{id:'incident', nm:'人員意外', ico:'🚑', x:58, y:58, status:'planned', kind:'core',
    script:'志工在現場受傷是慈濟出班一定會遇到的情境，但原有系統完全沒有這個流程。人員意外模組讓班長即時回報：傷者姓名/情況/GPS/任務ID，自動通知總指揮和傷者緊急聯絡人，生成事故記錄（保險理賠用）。報到時間戳+GPS+任務ID構成不可竄改的「出班證明」，確保保險理賠有據可查。',
    desc:'傷亡即時回報→通知總指揮+緊急聯絡人。自動生成事故記錄（含時間戳/GPS/任務ID）。保險理賠不可竄改依據。'}
  ,{id:'matchengine', nm:'智慧媒合引擎', ico:'🤖', x:72, y:58, status:'planned', kind:'future',
    script:'智慧媒合是 Phase 4 的功能，需要至少 3 次真實出班資料才有意義，做早了是空殼。媒合評分公式：score = (1/距離)×0.4 + 技能匹配×0.3 + 可用容量/需求人數×0.2 + (1/當前負載)×0.1。任務發布時自動計算 Top3 推薦班組並附推薦原因，班長可接受或拒絕。當某班 SOS 或有人離隊，重新計算是否需要支援。這個引擎讓調度從「幹部拍腦袋」進化為「資料驅動」。',
    desc:'Phase 4。媒合評分：距離40%+技能30%+容量20%+負載10%。任務發布自動推薦Top3。SOS觸發重新媒合。需3次以上真實出班資料。'}
];

// ── 連線 ──
var EDGES=[
  {from:'drill',to:'dashboard',label:'平時啟動',story:0,
    talk:'平時演練和儀表板之間的連線，代表系統有兩種運作模式。這條線確保系統在沒有災害的時候不會閒置——幹部可以隨時發起演練場次，讓所有人在低壓環境下熟悉完整流程。',
    flow:'平時模式進入。傳輸：演練劇本載入、情境參數初始化，儀表板進入平時模式。'},
  {from:'volunteer',to:'activate',label:'當區觸發',story:0,
    talk:'這條線代表一個重要的設計選擇：啟動權在現場，不在指揮部。讓第一線志工觸發戰時啟動，系統反應速度就等於志工的反應速度，而不是等逐層回報再下令。',
    flow:'當區志工於災害發生時觸發戰時啟動。傳輸：災害位置、初判等級。'},
  {from:'activate',to:'dashboard',label:'戰時啟動',story:0,
    talk:'戰時啟動到儀表板這條線，讓系統配置自動跟著災害類型走。不同的災型（颱風、地震、水災）需要開不同的模組，這條連線讓這件事自動發生，不需要幹部手動切換。',
    flow:'戰時模式進入。傳輸：災型/受災等級，動態開關模組並預置任務範本，儀表板進入戰時模式。'},
  {from:'staff',to:'dashboard',label:'操作',
    talk:'指揮端與儀表板的連線是雙向互動：幹部在儀表板上看數據、下達指令、調整情境模擬。儀表板是幹部日常管理系統的主要入口，不只是觀看，而是實際操作。',
    flow:'幹部/高層操作儀表板。傳輸：UI 互動、模擬參數、版面設定。純前端。'},
  {from:'dashboard',to:'rtsync',label:'戰時派遣',story:1,
    talk:'儀表板到調度中台是「決策轉為行動」的關鍵連線。高層在儀表板做的判斷（支援哪裡、優先哪個），透過這條線轉成調度中台的任務範本和優先級，讓現場執行有明確依據。',
    flow:'戰時自儀表板觸發派遣。傳輸：災型/等級參數，預置調度中台任務範本與優先級。'},
  {from:'staff',to:'rtsync',label:'指揮',
    talk:'幹部到調度中台的直接連線，讓指揮和調度能同步進行。幹部不需要透過儀表板中轉就能直接建立任務、調整指派——在快速變化的現場，減少操作步驟就是減少出錯的機會。',
    flow:'幹部下達指揮。傳輸：任務建立/指派/狀態變更，寫派工並觸發推播與稽核。'},
  {from:'volunteer',to:'lineoa',label:'報到',story:2,
    talk:'志工用 LINE 報到這條線的設計前提是：不能要求志工在緊急狀況下學新工具。LINE 是他們已經熟悉的通訊軟體，報到流程嵌在裡面，進入系統的門檻就接近零。',
    flow:'志工經 Line OA 自助報到。傳輸：身分、報到時間、場次標記。'},
  {from:'lineoa',to:'reg',label:'寫名冊',story:2,
    talk:'LINE OA 到名冊這條線消除了人工抄寫的環節。過去志工報到後，幹部需要手動記錄或整理，容易漏、容易錯。自動寫入讓「人到位」這個事實立刻進入系統，沒有延遲。',
    flow:'報到資料寫入幹部端名冊。傳輸：志工身分、報到狀態。'},
  {from:'reg',to:'rtsync',label:'可派人力',story:2,
    talk:'名冊到調度中台這條線讓「人到了」和「可以被派工」之間沒有斷點。調度中台不需要幹部手動告知「現在有多少人」，它從名冊自動取得可用人力清單，加上技能標記，派工時就有完整依據。',
    flow:'名冊提供可派人力。傳輸：在位志工清單、技能標記，供調度媒合。'},
  {from:'vms',to:'rtsync',label:'指派',
    talk:'志工管理到調度中台，讓人員編組的決策直接反映在現場執行上。幹部在志工管理模組決定誰加入哪個隊伍，這個結果自動進入調度中台，不需要再次手動輸入。',
    flow:'志工管理指派結果進中台。傳輸：人員編組、任務分派名單。'},
  {from:'lineoa',to:'rtsync',label:'叫料/回報 ↔ 派送',bi:true,story:3,
    talk:'LINE OA 和調度中台之間的雙向連線是整個系統使用頻率最高的一條。去程是志工的聲音進入系統（叫料需求、勘災回報、完工回執）；回程是系統通知志工（派工指令、物資派送通知、廣播、點名）。這條線讓前線和指揮在同一個資訊空間裡，不再靠電話傳話。',
    flow:'雙向。去程(志工→中台)：叫料需求(品項/數量/地點)、勘災回報、完成回執。回程(中台→志工)：派送通知、派工、廣播、點名。中台居中媒合，Line OA 兩端進出。'},
  {from:'sorting',to:'warehouse',label:'入庫',story:4,
    talk:'整理站到倉儲這條線是物資管理流程的第一個轉折點：捐贈物資在整理站完成分類和品質確認後才入庫，確保進入倉儲的每一件物資都有清楚的分類紀錄，不讓「不知道有什麼」的情況發生在調度時。',
    flow:'整理後入庫。傳輸：分類完成物資、品項數量造冊。'},
  {from:'warehouse',to:'rtsync',label:'庫存可用',story:4,
    talk:'倉儲到調度中台這條連線讓物資分配有了客觀基礎。幹部在調度媒合時直接看到即時庫存，缺料告警也從這裡觸發——決策不再靠記憶或詢問，而是看數字。',
    flow:'倉儲回報可用量供調度。傳輸：庫存量、備貨進度、缺料告警。'},
  {from:'rtsync',to:'fieldgroup',label:'分案/進度',bi:true,story:5,
    talk:'調度中台和現場群之間的雙向線，是「指令」和「執行」之間的橋樑。從中台到現場：任務分案、物資指令、人力編組。從現場到中台：執行進度、個案紀錄、現場需求。這條線讓指揮端不需要打電話就能知道現場的實際狀況。',
    flow:'雙向。去程(中台→現場)：任務分案、特殊物資/安心祝福金發放指令、人力編組、座標。回程(現場→中台)：執行進度、個案/關懷紀錄、現場需求。'},
  {from:'lineoa',to:'drive',label:'照片上傳',
    talk:'照片從 LINE OA 上傳是最低門檻的現場回報方式。志工不需要額外的工具，拍完直接傳，系統負責對應個案和分類——讓「留下影像紀錄」這件事的阻力接近零。',
    flow:'志工回傳照片。傳輸：現場影像→Drive 自動分類。'},
  {from:'drive',to:'fieldgroup',label:'歸檔',dash:true,
    talk:'照片歸檔到個案這條線目前是虛線（規劃中），等 Google Drive API 設定完成後啟用。設計目標是讓每張照片都自動對應到正確的個案資料，事後整理時不需要人工對號。',
    flow:'照片歸入個案/現場紀錄。傳輸：分類後影像關聯個案。後端待設定，虛線。'},
  {from:'rtsync',to:'story',label:'結案',story:6,
    talk:'調度中台到故事線結案，是讓每一場救災的經驗被留存下來的關鍵連線。任務結束後，完整的 audit log 自動進入故事線，不需要人工彙整報告——做了什麼、誰做的、什麼時候、花了多少時間，全部都在。',
    flow:'任務結案彙整。傳輸：全生命週期 audit log、照片、回執，串故事線。'},
  {from:'rtsync',to:'backend',label:'即時暫存',story:6,
    talk:'調度中台到後端的即時暫存是針對「災區網路不穩定」這個現實設計的。每個操作都先寫本機 localStorage，不管網路狀況都不掉資料，連線後自動上傳。這確保幹部在現場可以放心操作，不用擔心斷網就前功盡棄。',
    flow:'調度狀態即時落後端。傳輸：任務/派工/警報狀態寫 localStorage，離線可用，連線後上傳。'},
  {from:'backend',to:'story',label:'場次遙測',story:6,
    talk:'後端場次遙測到故事線，讓結案報告不只有「做了什麼」，還有「系統表現如何」。哪個功能卡頓、哪個步驟出錯、整場的操作時序——這些數據讓下一次迭代有具體的改善依據，而不是靠感覺說「這裡不順」。',
    flow:'後端遙測供敘事。傳輸：session 場次、錯誤聚合、UX 卡頓，注入故事線。'},
  {from:'warehouse',to:'backend',label:'造冊',dash:true,
    talk:'倉儲造冊到後端這條虛線，等 Google Sheets 設定完成後啟用。目標是讓物資進出紀錄有雲端備份，任何幹部都能從不同裝置查閱當前庫存，不受限於哪台電腦有最新資料。',
    flow:'倉儲造冊同步後端。傳輸：物資與庫存異動至 Sheets。待設定，虛線。'},
  {from:'fieldgroup',to:'backend',label:'個案存',dash:true,
    talk:'個案資料寫入後端這條連線帶著最敏感的資料——鄉親的姓名、身分、聯絡方式、受災情況。目前這條線是虛線且個資未加密，是整個系統最高優先的資安待修項目（P1）。在加密機制到位之前，個資的操作和存取都需要特別謹慎。',
    flow:'個案資料寫後端。傳輸：訪視紀錄、慰問金、修繕至 GAS/Sheets。含個資待加密，虛線。'},
  {from:'sysadmin',to:'backend',label:'設定/備份',
    talk:'系統管理層到後端的連線，讓所有設定都有持久化的記錄。版本備份讓誤操作有後路，戰時災型預設讓不同場景的系統配置可以一鍵還原——這條線確保「設定」這件事是可管理的，而不是每次都要重新來過。',
    flow:'系統管理讀寫設定與備份。傳輸：權限設定、模組開關、版本備份還原、戰時災型預設。'},
  {from:'monitor',to:'rtsync',label:'監看',dash:true,
    talk:'全域監控唯讀監看的設計原則是「看的人不能誤按到什麼」。當指揮中心的大屏投影給外部單位或長官看的時候，不能有任何可被意外觸發的操作。這條線是單向虛線，確保監看行為不回寫、不干擾現場調度。',
    flow:'全域監控唯讀監看。傳輸：任務/需求/連線狀態摘要單向上拋，不回寫，虛線。'},
  {from:'monitor',to:'emic',label:'未來對接',dash:true,
    talk:'全域監控和政府 EMIC 之間的連線是一個長期目標的預告。把它畫在架構圖上，是讓所有參與者都知道這個系統最終不是孤立運作的——它應該成為政府救災體系的一部分，而不只是慈濟內部的工具。',
    flow:'規劃中與政府對接。傳輸：與 EMIC 雙向交換災情/資源。尚未實作，虛線。'},
  {from:'rtsync',to:'backend',label:'同步 ↔',bi:true,dash:true,
    talk:'調度中台和後端之間的雙向同步（Firebase RTDB）解決的是多站點協作問題。當救災規模擴大，多個行政區的幹部需要同時操作同一套系統時，localStorage 就不夠用了——不同電腦的資料會脫節。Firebase 多人共編介面已預留，等使用需求確認後啟用，讓系統從「單點工具」進化成「分散式指揮平台」。',
    flow:'雙向(規劃)。多站點即時共編：任務/人力/設備經 Firebase RTDB 雙向同步。介面已預留未啟用，虛線。'}

  /* ── 人力鏈（Person→Squad→Task） ── */
  ,{from:'reg', to:'squad', label:'歸隊',
    talk:'志工報到後不只是「進名冊」，而是立刻歸隊到對應班組。這條線讓班長手機即時看到本班人數，任務執行人力也同步更新。',
    flow:'報到資料寫入後，查詢 DATA.squads[].members 確認歸屬，班組 currentLoad +1，班長端即時更新。'}
  ,{from:'squad', to:'taskpool', label:'接單', bi:true,
    talk:'班長從任務池接單（或被 HQ 指派），接單後任務狀態從 open→claimed，班員同步收到 LINE 推播。這是 Uber 模式的核心迴路。',
    flow:'雙向。去程(HQ→班組)：指派任務。回程(班組→任務池)：班長搶單，更新 task.claimedBy 和 claimedAt。'}
  ,{from:'tier', to:'squad', label:'排定梯次',
    talk:'梯次確認後，班組知道自己幾點去哪裡、開哪台車。梯次是出班的時間骨架，班組是執行單位，這條線把時間和人力綁在一起。',
    flow:'梯次建立後推播給班長（LINE OA）。DATA.tiers[].squads 指向對應班組，班長端顯示梯次資訊。'}
  ,{from:'tier', to:'vms', label:'車輛配對', dash:true,
    talk:'梯次建立時，系統同時檢查每個班組是否有配屬車輛。缺車時自動建議配對，確認後推播給司機。',
    flow:'梯次建立→檢查 DATA.vehicles 可用清單→缺車警示+配對建議→確認後 vehicle.assignedTier 寫入。'}
  ,{from:'vms', to:'squad', label:'車輛派遣',
    talk:'司機打卡出發後，班長手機收到預計抵達時間。車輛抵達後班員掃碼上車確認，物資裝載觸發倉儲扣庫存。',
    flow:'vehicle.status = en-route → 班長端推播。抵達後班員確認 → vehicle.cargo 掃描 → 倉儲自動扣庫存。'}
  ,{from:'fieldgroup', to:'taskpool', label:'分診建任務',
    talk:'勘災組到場填寫分診標籤後，系統自動生成對應任務進入任務池：紅標→P0/P1立即任務，黃標→P2一般任務，綠標→電話追蹤任務。這條線讓「個案需求」直接驅動「人力派遣」，中間不需要人工中轉。',
    flow:'Case.triageTag 寫入後自動建 Task，status=open，依顏色設優先級，推入任務池。Case.status 跟隨 Task 更新。'}
  ,{from:'taskpool', to:'fieldgroup', label:'任務完成更新', dash:true,
    talk:'任務完成回報後，對應個案狀態自動更新，完成照片與入場照片自動配對成 Before/After，同時判斷是否需要追蹤任務（48h 後自動觸發）。',
    flow:'task.status=done → 更新 case.status → Before/After 照片配對 → 若需追蹤，48h 後自動建追蹤任務推入任務池。'}
  ,{from:'rtsync', to:'handover', label:'收班快照',
    talk:'每梯次收班觸發交接流程。調度中台自動抓取當下狀態快照，班長不需從零打字，只需確認並補充空白欄位。',
    flow:'收班動作 → 系統抓取：未完 Task（status=in-progress）、物資差異（cargo diff）、紅標未結 Case。班長確認→存檔→推播下梯。'}
  ,{from:'handover', to:'squad', label:'下梯交接',
    talk:'交接記錄推播給下一梯的所有班長，讓他們在接任務前就知道前一梯的現場狀況、未完成工作和待追蹤個案。',
    flow:'交接記錄存檔後推播給 TIER-N+1 的所有班長 LINE OA。下梯班長接單時可看到前一梯的 fieldNotes。'}
  ,{from:'fieldgroup', to:'relief_ledger', label:'核准發放',
    talk:'個案達到金援核准狀態後，自動帶入受災戶資訊建立 RF 單，不允許手動輸入發放對象，防止錯誤發放。',
    flow:'case.status=approved → 自動建 RF 單，帶入 case.recipient/idLastFour。發放五步驟完成後寫不可刪帳本。'}
  ,{from:'relief_ledger', to:'backend', label:'帳務存檔',
    talk:'每筆發放記錄寫入後端後，自動 Gmail 通知財務組（附 PDF），月底自動匯出總表 CSV。帳本只可新增，不可刪除或修改。',
    flow:'RF 單確認 → 寫不可刪帳本 → Gmail 推財務組（附 PDF）→ 月底自動 CSV 匯出供對帳。'}
  ,{from:'squad', to:'incident', label:'意外回報',
    talk:'班長在現場回報人員意外，觸發自動通知和保險記錄生成。報到時間戳+GPS+任務ID構成不可竄改的保險理賠依據。',
    flow:'班長觸發 → 建 MedicalIncident → 通知總指揮+傷者緊急聯絡人 → 生成事故記錄（含報到時間戳/GPS/任務ID）。'}
  ,{from:'matchengine', to:'taskpool', label:'媒合推薦', dash:true,
    talk:'智慧媒合引擎分析歷史出班資料，在任務發布時自動推薦最適合的班組，並在 SOS 或人員離隊時重新計算支援建議。Phase 4 功能，需有足夠真實資料才有意義。',
    flow:'任務發布 → 媒合評分（距離/技能/容量/負載）→ Top3 推薦→ HQ 確認或班長接受。SOS 觸發重算。'}
  ,{from:'backend', to:'matchengine', label:'歷史資料', dash:true,
    talk:'智慧媒合需要從後端讀取歷史出班記錄：每個班組的任務類型、完成時間、人力效率，才能做出有意義的預測。',
    flow:'後端歷史記錄 → 媒合引擎學習模式：每人/每班在不同任務類型的平均效率，用於任務耗時預估和備料建議。'}
];

// ── 三視角：每視角的節點集 + 專屬故事腳本 ──
// VIEWS[view].nodes = 該視角顯示(其餘淡出)；stories = 旁白，每段 on=點亮節點，warn=紅標
var VIEWS={
  decider:{
    label:'決策者',
    nodes:['drill','activate','volunteer','dashboard','staff','rtsync','reg','fieldgroup','sorting','warehouse','story','lineoa','squad','taskpool','tier','cmdmap','handover','relief_ledger'],
    stories:[
      {step:'啟動',on:['activate','volunteer','drill','dashboard'],
        text:'災害發生，當區志工觸發戰時啟動，系統一鍵切戰時模式，總控儀表板亮起 — 這是所有決策的起點。'},
      {step:'盤點',on:['dashboard'],
        text:'儀表板即時顯示受災戶數、撤離人數、志工到位、物資完成率。一眼掌握全局，不必等回報。'},
      {step:'調度',on:['dashboard','rtsync'],
        text:'儀表板下達戰時派遣，即時調度中台接手，把任務派到第一線。'},
      {step:'動員',on:['volunteer','lineoa','reg','rtsync'],
        text:'志工完成報到後立刻成為可派人力 — 人到位，任務就能發。'},
      {step:'照顧',on:['rtsync','fieldgroup'],
        text:'任務分案到現場，安置、個案、關懷同步啟動，特殊物資與安心祝福金送到鄉親手上。'},
      {step:'物資',on:['sorting','warehouse','rtsync'],
        text:'一般物資由志工整理入庫、依需求調撥，缺料即時補。'},
      {step:'交代',on:['rtsync','story'
      ,{step:'班組指揮',on:['squad','taskpool','tier','cmdmap'],
        text:'梯次排班確認誰幾點去哪，班長從任務池一鍵接單，作戰指揮圖讓 HQ 同時看到所有班的即時狀態——從「指揮官拍腦袋」到「資料驅動調度」。'}
      ,{step:'交接閉環',on:['handover','squad','rtsync'],
        text:'每梯收班，系統自動生成交接快照：未完任務、物資差異、待追蹤個案。下梯班長接任前已知前一梯的所有現場狀況，資訊不再靠口頭傳話。'}
      ,{step:'帳務透明',on:['relief_ledger','fieldgroup','backend'],
        text:'金援發放有完整簽收鏈：身份確認、雙人見證、受災戶簽名、存證照、自動 Gmail 給財務。每一筆發放都可追溯，讓慈濟的公信力有資料支撐。'}
    ],
        text:'每場救災自動串成故事線時間軸 — 做了什麼、誰做的、成效如何，可匯出成完整紀錄向外說明。'}
    ]
  },
  volunteer:{
    label:'志工',
    nodes:['volunteer','lineoa','reg','rtsync','fieldgroup','sorting','warehouse','drive','squad','taskpool','handover','incident'],
    stories:[
      {step:'我報到',on:['volunteer','lineoa'],
        text:'我用手機開 Line OA，完成報到，系統就知道我到了。'},
      {step:'我入列',on:['lineoa','reg'],
        text:'我的報到資料進入名冊，我成為今天可以被派任務的人。'},
      {step:'我收任務',on:['rtsync','lineoa'],
        text:'調度中台把任務透過 Line OA 發給我，我在手機上就收到。'},
      {step:'我叫料',on:['lineoa','rtsync'],
        text:'現場缺東西，我直接在 Line OA 回報需求，後勤媒合好再通知我領取。'},
      {step:'我執行',on:['rtsync','fieldgroup'],
        text:'我到安置點 / 個案家現場服務，發放物資或安心祝福金。'},
      {step:'我回報',on:['drive','lineoa','rtsync'],
        text:'我拍照、回填進度，經 Line OA 傳回中台，任務狀態即時更新。'}
    ]
  },
  tech:{
    label:'技術維運',
    nodes:['lineoa','rtsync','backend','story','sysadmin','monitor','emic','dashboard','squad','taskpool','tier','cmdmap','handover','relief_ledger','incident','matchengine'],
    stories:[
      {step:'入口',on:['lineoa','rtsync','dashboard'],
        text:'前端是單檔 HTML，無框架。使用者操作與 Line OA 回報都先進即時調度中台這個前端樞紐。'},
      {step:'落盤',on:['rtsync','backend'],
        text:'所有狀態即時寫 localStorage（drms_data / 版本備份 / 場次 / 遙測），離線可用，連線後再分段上傳。'},
      {step:'後端',on:['backend'],
        text:'後端服務層含三塊 — 本機 localStorage、GAS+Sheets（報名/個案，待設定 /exec）、Firebase RTDB（多人共編，介面已預留未啟用）。'},
      {step:'設定',on:['sysadmin','backend'],
        text:'系統管理層讀寫權限設定、模組開關、版本備份還原、戰時災型預設。'},
      {step:'遙測',on:['backend','story'],
        text:'場次與錯誤聚合、UX 卡頓資料注入故事線，結案時串成可重播的演練劇本。'},
      {step:'待修',on:['backend','sysadmin','lineoa'],warn:['backend','sysadmin','lineoa'],
        text:'⚠ 個資明文存 localStorage/Sheets 僅前端遮蔽（P1 待加密）；role 判斷前端可竄改（待後端驗證）；GAS URL 硬編碼；政府 EMIC / 警報 API 尚未串接。'}
    ]
  }
};
var curView='decider';
// 相容舊變數：storyShow 用 activeStories()
function activeStories(){return VIEWS[curView]?VIEWS[curView].stories:[];}

// ── 健檢資料：每節點健康狀態 done/todo/risk/merge + 問題詳情 ──
var HEALTH={
  dashboard:{s:'done',issue:'運作中。但與全域監控 KPI 重疊，建議釐清「可操作總覽 vs 唯讀大屏」分工。AI 戰術分析入口為規劃中。'},
  monitor:{s:'merge',issue:'與總控儀表板 KPI 重疊。建議整合為儀表板的「簡報/唯讀大屏模式」，或明確分工。即時影像與連線狀態目前為模擬。'},
  rtsync:{s:'done',issue:'核心運作正常。現場唯一指揮橋樑，4 tab 完整。'},
  reg:{s:'merge',issue:'與報名資料總表、志工管理共用 Master_Profiles，職責邊界模糊。建議半拆為「志工資料域」群組。'},
  sheet_reg:{s:'todo',issue:'GAS 後端已建但需設定 /exec 網址；且 GAS URL 目前硬編碼待改（P1）。與 reg/vms 可整合。'},
  vms:{s:'merge',issue:'人員資料與任務指派。與 reg/sheet_reg 共用名冊資料，建議整合為志工資料域。'},
  lineoa:{s:'risk',issue:'模擬器完整（報到/3-tap叫料/餐食表單/關懷）但真實 LINE Webhook 後端 0%。個資經此入口，role 前端可竄改（P1 資安）。'},
  drive:{s:'todo',issue:'前端分類邏輯完成，Google Drive API 串接待設定。'},
  sorting:{s:'done',issue:'物資整理站運作正常。'},
  warehouse:{s:'done',issue:'三級造冊運作正常。對外出貨經調度中台媒合。'},
  fieldgroup:{s:'done',issue:'L3 現場群運作正常。含安置/個案/關懷/資產。個案含個資，寫後端時需加密（見 backend）。'},
  story:{s:'todo',issue:'單場故事線完成。建議新增「跨場次比較」供決策者看趨勢。'},
  staff:{s:'done',issue:'指揮端角色正常。'},
  volunteer:{s:'done',issue:'前線志工角色正常。建議依角色裁剪 Line OA 選單（一般志工不需關懷/提權）。'},
  sysadmin:{s:'risk',issue:'權限控管所在地。前端 role 判斷可被 console 竄改，提權流程發金鑰全在前端可偽造，需後端驗證（P1）。'},
  backend:{s:'risk',issue:'個資（身分證/電話）明文存 localStorage 與 Sheets，僅前端遮蔽未加密（P1 最高優先）。多人共編 Firebase 已預留未啟用。'},
  emic:{s:'todo',issue:'政府 EMIC 與警報 API 尚未串接，近期不做可考慮再縮小或移除。'},
  drill:{s:'done',issue:'平時演練啟動正常。'},
  activate:{s:'done',issue:'戰時啟動正常。'}

  ,squad:        {s:'todo', issue:'Phase 0-A 核心。DATA.squads schema 尚未建立。志工報到歸隊邏輯、班長手機介面待開發。所有後續功能的地基。'}
  ,taskpool:     {s:'todo', issue:'Phase 0-B 核心。Task 資料模型需擴充（status/claimedBy/location/requiredSkills）。班長視角任務池頁面待開發。'}
  ,tier:         {s:'todo', issue:'Phase 1-A。梯次排班頁面、車輛缺口自動檢查、班長確認推播待開發。'}
  ,cmdmap:       {s:'todo', issue:'Phase 1-C。需要地圖底圖 API（建議 Leaflet.js，免費）。班組即時 GPS 定位、熱力圖層待開發。'}
  ,handover:     {s:'todo', issue:'Phase 1-D。收班流程強制走完、快照自動生成邏輯、存檔不可修改機制待開發。'}
  ,relief_ledger:{s:'todo', issue:'Phase 3-A。發放五步驟流程、canvas 簽名、不可刪帳本、Gmail PDF 推送待開發。帳務嚴謹，技術難度中等。'}
  ,incident:     {s:'todo', issue:'Phase 1-D 附帶。人員意外回報表單、緊急聯絡人通知、保險記錄 PDF 生成待開發。'}
  ,matchengine:  {s:'todo', issue:'Phase 4，最後做。需 3+ 次真實出班資料。媒合評分公式已設計，待實作。做早了是空殼。'}
};
var HEALTH_LBL={done:'完成',todo:'待補',risk:'風險',merge:'可整合'};
// 整合群組灰框（健檢視角顯示，標記建議不動結構）
var MERGE_FRAMES=[
  {lbl:'建議整合：志工資料域',nodes:['reg','sheet_reg','vms']},
  {lbl:'建議整合：監控併簡報模式',nodes:['monitor','dashboard']}
];
// 健檢走查旁白
VIEWS.health={
  label:'健檢',
  nodes:Object.keys(HEALTH),
  stories:[
    {step:'總覽',on:[],
      text:'健檢視角：綠=完成、黃=待補、紅=資安風險、灰=建議整合。點任一節點看該模組的健檢結論。以下逐項走查。'},
    {step:'資安風險',on:['backend','sysadmin','lineoa'],warn:['backend','sysadmin','lineoa'],
      text:'🔴 三個資安紅點：後端（個資明文存 localStorage/Sheets 未加密，P1 最高優先）、系統管理層（role 前端可竄改、提權可偽造）、Line OA（真實 Webhook 0%、個資入口）。'},
    {step:'待補功能',on:['sheet_reg','drive','story','emic'],
      text:'🟡 待補：報名總表（GAS /exec 待設定、URL 硬編碼）、照片分類（Drive API 未接）、故事線（缺跨場次比較）、政府 EMIC（未串接）。'},
    {step:'可整合',on:['reg','sheet_reg','vms','monitor','dashboard'],
      text:'⬜ 建議整合：報到/報名總表/志工管理共用名冊→併「志工資料域」；全域監控與儀表板 KPI 重疊→併簡報模式。此為建議標記，不動現有結構。'},
    {step:'新增建議',on:['volunteer','fieldgroup','lineoa'],
      text:'🟢 新增建議：任務地圖（P3，志工/現場最需要「我要去哪」）；志工選單依角色裁剪（一般志工不需關懷/提權）；Firebase 多人共編演進。'}
  ]
};

var statusTag={live:'\uD83D\uDFE2 已開通',partial:'\uD83D\uDFE1 部分 / 待設定',planned:'\uD83D\uDD34 未開通 / 規劃中'};
var nodeById={};NODES.forEach(function(n){nodeById[n.id]=n;});
var DEFAULT_POS={};NODES.forEach(function(n){DEFAULT_POS[n.id]={x:n.x,y:n.y};});
var STORE_KEY='drms_arch_layout_v2';
document.getElementById('arch2-ver').textContent='v5.0 · 班長制強化版';
var stage=document.getElementById('arch2-stage');
var svg=document.getElementById('arch2-edges');
var detail=document.getElementById('arch2-detail');
var VW=1000,VH=688;

// E6: use localStorage for position persistence instead of sessionStorage
var POS_KEY='drms_arch2_pos';
function loadPos(){try{var raw=window.localStorage.getItem(POS_KEY)||window.sessionStorage.getItem(STORE_KEY);if(raw){var p=JSON.parse(raw);NODES.forEach(function(n){if(p[n.id]&&!n.locked){n.x=p[n.id].x;n.y=p[n.id].y;}});}}catch(e){}}
function savePos(){var p={};NODES.forEach(function(n){p[n.id]={x:n.x,y:n.y};});try{window.localStorage.setItem(POS_KEY,JSON.stringify(p));}catch(e){}}

function buildZones(){ZONES.forEach(function(z){var el=document.createElement('div');el.className='zone '+z.cls;el.style.left=z.x+'%';el.style.top=z.y+'%';el.style.width=z.w+'%';el.style.height=z.h+'%';el.innerHTML='<div class="zone-lbl">'+z.lbl+'</div>';stage.appendChild(el);});}
function buildNodes(){NODES.forEach(function(n){var el=document.createElement('div');el.className='node '+n.status+(n.center?' center':'')+(n.trigger?' trigger':'')+(n.mini?' mini':'');el.id='arch2-node-'+n.id;el.style.left=n.x+'%';el.style.top=n.y+'%';el.innerHTML='<div class="hbadge" id="arch-hb-'+n.id+'"></div><div class="st '+n.status+'"></div><div class="ico">'+n.ico+'</div><div class="nm">'+n.nm+'</div><div class="kd">'+n.kind+'</div>';stage.appendChild(el);attachDrag(el,n);});}
function buildMergeFrames(){MERGE_FRAMES.forEach(function(mf,fi){var el=document.createElement('div');el.className='merge-frame';el.id='arch2-mf-'+fi;el.innerHTML='<div class="mf-lbl">'+mf.lbl+'</div>';stage.appendChild(el);});}
function positionMergeFrames(){MERGE_FRAMES.forEach(function(mf,fi){var el=document.getElementById('arch2-mf-'+fi);if(!el)return;var xs=[],ys=[];mf.nodes.forEach(function(id){var n=nodeById[id];if(n){xs.push(n.x);ys.push(n.y);}});if(!xs.length)return;var pad=7;var minx=Math.min.apply(null,xs)-pad,maxx=Math.max.apply(null,xs)+pad,miny=Math.min.apply(null,ys)-pad,maxy=Math.max.apply(null,ys)+pad;el.style.left=minx+'%';el.style.top=miny+'%';el.style.width=(maxx-minx)+'%';el.style.height=(maxy-miny)+'%';});}
function px(p){return p/100*VW;}function py(p){return p/100*VH;}
function buildEdges(){svg.setAttribute('viewBox','0 0 '+VW+' '+VH);var defs='<defs>'
  +'<marker id="arr" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#B8B8C0"/></marker>'
  +'<marker id="arrH" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#6B8CBE"/></marker>'
  +'<marker id="arrR" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto-start-reverse"><path d="M0,0 L7,3 L0,6 Z" fill="#B8B8C0"/></marker>'
  +'<marker id="arrRH" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto-start-reverse"><path d="M0,0 L7,3 L0,6 Z" fill="#6B8CBE"/></marker>'
  +'</defs>';svg.innerHTML=defs;EDGES.forEach(function(e,i){drawEdge(e,i);});}
function edgePath(a,b){
  var x1=px(a.x),y1=py(a.y),x2=px(b.x),y2=py(b.y);
  var dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy)||1;
  var ux=dx/len,uy=dy/len;        // 連線單位向量
  var nx=-uy,ny=ux;                // 法線單位向量
  // 法線側推：依長度比例(8%)，夾在 14~46px，短線少彎長線多彎
  var bow=Math.max(14,Math.min(46,len*0.08));
  // 控制點沿連線方向內縮 28%，讓曲線從端點「順出順入」而非從中點硬折
  var off=len*0.28;
  var c1x=x1+ux*off+nx*bow, c1y=y1+uy*off+ny*bow;
  var c2x=x2-ux*off+nx*bow, c2y=y2-uy*off+ny*bow;
  // label 取曲線參數中點(t=0.5)的三次貝茲座標
  var mx=0.125*x1+0.375*c1x+0.375*c2x+0.125*x2;
  var my=0.125*y1+0.375*c1y+0.375*c2y+0.125*y2;
  return {d:'M'+x1+','+y1+' C'+c1x+','+c1y+' '+c2x+','+c2y+' '+x2+','+y2, lx:mx, ly:my};
}
function drawEdge(e,i){var a=nodeById[e.from],b=nodeById[e.to];var pp=edgePath(a,b);var path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',pp.d);path.setAttribute('fill','none');path.setAttribute('stroke','#C4C4CC');path.setAttribute('stroke-width','2');path.setAttribute('marker-end','url(#arr)');if(e.dash)path.setAttribute('stroke-dasharray','5,5');if(e.bi)path.setAttribute('marker-start','url(#arrR)');path.setAttribute('id','arch-edge-'+i);path.onclick=(function(idx){return function(){selectEdge(idx);};})(i);svg.appendChild(path);var lab=document.createElement('div');lab.className='elabel';lab.id='arch2-elabel-'+i;lab.style.left=(pp.lx/VW*100)+'%';lab.style.top=(pp.ly/VH*100)+'%';lab.textContent=e.label;lab.onclick=(function(idx){return function(){selectEdge(idx);};})(i);stage.appendChild(lab);}
function refreshEdges(){EDGES.forEach(function(e,i){var a=nodeById[e.from],b=nodeById[e.to];var pp=edgePath(a,b);var path=document.getElementById('arch2-edge-'+i);if(path)path.setAttribute('d',pp.d);var lab=document.getElementById('arch2-elabel-'+i);if(lab){lab.style.left=(pp.lx/VW*100)+'%';lab.style.top=(pp.ly/VH*100)+'%';}});}

function attachDrag(el,n){var dragging=false,moved=false,sx,sy;
  function down(ev){if(n.locked)return;dragging=true;moved=false;el.classList.add('dragging');var pt=ev.touches?ev.touches[0]:ev;sx=pt.clientX;sy=pt.clientY;window.addEventListener('mousemove',move);window.addEventListener('mouseup',up);window.addEventListener('touchmove',move,{passive:false});window.addEventListener('touchend',up);ev.preventDefault();}
  function move(ev){if(!dragging)return;var pt=ev.touches?ev.touches[0]:ev;if(Math.abs(pt.clientX-sx)>3||Math.abs(pt.clientY-sy)>3)moved=true;var rect=stage.getBoundingClientRect();var nx=(pt.clientX-rect.left)/rect.width*100,ny=(pt.clientY-rect.top)/rect.height*100;nx=Math.max(2,Math.min(98,nx));ny=Math.max(2,Math.min(98,ny));n.x=nx;n.y=ny;el.style.left=nx+'%';el.style.top=ny+'%';refreshEdges();if(curView==='health')positionMergeFrames();ev.preventDefault();}
  function up(){if(!dragging)return;dragging=false;el.classList.remove('dragging');window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up);window.removeEventListener('touchmove',move);window.removeEventListener('touchend',up);if(moved){savePos();}else{selectNode(n.id);}}
  el.addEventListener('mousedown',down);
  el.addEventListener('touchstart',down,{passive:false});
  if(n.locked){el.style.cursor='pointer';el.addEventListener('click',function(){selectNode(n.id);});}
}

function clearSel(){var ss=root.querySelectorAll('.node.sel,.elabel.sel');for(var i=0;i<ss.length;i++)ss[i].classList.remove('sel');EDGES.forEach(function(e,i){var p=document.getElementById('arch2-edge-'+i);if(p){p.classList.remove('edge-active');p.setAttribute('stroke','#C4C4CC');p.setAttribute('marker-end','url(#arr)');if(e.bi)p.setAttribute('marker-start','url(#arrR)');}});}
function selectNode(id){
  // E7: in story mode, pause story, show node detail, add "繼續故事" button
  if(storyOn){
    storyOn=false;
    document.getElementById('arch2-storyBar').classList.remove('warn-bar');
    // Show node detail with "繼續故事" button appended
    clearSel();
    var el=document.getElementById('arch2-node-'+id);if(el)el.classList.add('sel');
    var n=nodeById[id];if(!n)return;
    var scr=n.script?'<div style="background:linear-gradient(135deg,var(--accent-bg),var(--blue-bg));border:1px solid var(--accent-border);border-radius:var(--r-sm);padding:11px 13px;margin-bottom:10px;font-size:12.5px;line-height:1.85;color:var(--text)"><span style="font-size:10px;font-weight:700;color:var(--accent);letter-spacing:.05em">💡 設計說明</span><br>'+n.script+'</div>':'';
    detail.innerHTML='<div class="detail-head"><div class="dico">'+n.ico+'</div><div class="dt"><h3>'+n.nm+'</h3><div class="meta">'+n.id+' · 故事模式暫停</div></div></div><div class="detail-body">'+scr+'<div style="font-size:11px;color:var(--text3);margin-bottom:12px">'+n.desc+'</div>'
      +'<button onclick="arch2_storyResume()" style="border:none;background:var(--accent);color:#fff;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">▶ 繼續故事</button>'
      +'</div>';
    return;
  }
  // Normal mode:clearSel();var el=document.getElementById('arch2-node-'+id);if(el)el.classList.add('sel');var n=nodeById[id];EDGES.forEach(function(e,i){if(e.from===id||e.to===id){var p=document.getElementById('arch2-edge-'+i);if(p){p.classList.add('edge-active');p.setAttribute('marker-end','url(#arrH)');if(e.bi)p.setAttribute('marker-start','url(#arrRH)');}}});var subs=n.subs?'<div class="sub-mods">'+n.subs.map(function(s){return '<span class="sub-mod">'+s+'</span>';}).join('')+'</div>':'';var hext='';if(curView==='health'&&HEALTH[id]){var hs=HEALTH[id].s;var hcol={done:'green',todo:'amber',risk:'red',merge:'planned'}[hs];hext='<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)"><span class="tag '+hcol+'">🩺 '+HEALTH_LBL[hs]+'</span> <span style="font-size:11px">'+HEALTH[id].issue+'</span></div>';}var scr=n.script?'<div style="background:linear-gradient(135deg,var(--accent-bg),var(--blue-bg));border:1px solid var(--accent-border);border-radius:var(--r-sm);padding:11px 13px;margin-bottom:10px;font-size:12.5px;line-height:1.85;color:var(--text)"><span style="font-size:10px;font-weight:700;color:var(--accent);letter-spacing:.05em">💡 設計說明</span><br>'+n.script+'</div>':'';var pvBtn='<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap"><button onclick="arch2_pvShow(\''+n.id+'\',\''+n.nm.replace(/'/g,'')+'\')" style="border:none;background:var(--accent);color:#fff;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">🔍 看現況示意</button><button onclick="document.getElementById(\'arch-fbPanel\').classList.add(\'on\');if(!document.getElementById(\'arch-fbNode\').options.length)arch2_fbBuildNodeOptions_inner();document.getElementById(\'arch-fbNode\').value=\''+n.nm.replace(/'/g,'')+'\'" style="border:1px solid var(--accent-border);background:var(--accent-bg);color:var(--accent);padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">📝 對此寫回饋</button></div>';detail.innerHTML='<div class="detail-head"><div class="dico">'+n.ico+'</div><div class="dt"><h3>'+n.nm+' <span class="tag '+n.status+'">'+statusTag[n.status]+'</span></h3><div class="meta">'+n.id+' · '+n.kind+'</div></div></div><div class="detail-body">'+scr+'<div style="font-size:11px;color:var(--text3)">'+n.desc+'</div>'+subs+hext+pvBtn+'</div>';}
// E7: resume story after node click pause
function storyResume()
window.arch2_storyResume=storyResume;{ storyOn=true; document.getElementById('arch2-storyBar').classList.add('show'); storyShow(); }
function selectEdge(i){if(storyOn)return;clearSel();var e=EDGES[i];var p=document.getElementById('arch2-edge-'+i);if(p){p.classList.add('edge-active');p.setAttribute('marker-end','url(#arrH)');if(e.bi)p.setAttribute('marker-start','url(#arrRH)');}var lab=document.getElementById('arch2-elabel-'+i);if(lab)lab.classList.add('sel');var a=nodeById[e.from],b=nodeById[e.to];var dir=e.bi?'\u2194 雙向':'\u2192 單向';var etalk=e.talk?'<div style="background:linear-gradient(135deg,var(--accent-bg),var(--blue-bg));border:1px solid var(--accent-border);border-radius:var(--r-sm);padding:11px 13px;margin-bottom:10px;font-size:12.5px;line-height:1.85;color:var(--text)"><span style="font-size:10px;font-weight:700;color:var(--accent);letter-spacing:.05em">💡 設計說明</span><br>'+e.talk+'</div>':'';detail.innerHTML='<div class="detail-head"><div class="dico">'+(e.bi?'\u2194':'\u2192')+'</div><div class="dt"><h3>'+a.nm+' '+(e.bi?'\u2194':'\u2192')+' '+b.nm+' <span class="tag '+(e.dash?'planned':'live')+'">'+(e.dash?'規劃/次要':'現行')+'</span></h3><div class="meta">'+dir+' · 「'+e.label+'」</div></div></div><div class="detail-body">'+etalk+'<div style="font-size:11px;color:var(--text3)">'+e.flow+'</div></div>';}

// ── 故事導覽 ──
var storyOn=false,storyIdx=0;
function storyStart(){storyOn=true;storyIdx=0;document.getElementById('arch2-storyBar').classList.add('show');storyShow();}
function storyEnd(){storyOn=false;document.getElementById('arch2-storyBar').classList.remove('show','warn-bar');clearDim();clearSel();applyView();detail.innerHTML='<div class="detail-empty">▲ 拖曳排版 · 點節點或線看說明 · 或按 ▶ 故事導覽</div>';}
function storyPrev(){if(storyIdx>0){storyIdx--;storyShow();}}
function storyNext(){var S=activeStories();if(storyIdx<S.length-1){storyIdx++;storyShow();}else{storyEnd();}}
function clearDim(){var ds=root.querySelectorAll('.dim,.hot,.warn,.edge-active');for(var i=0;i<ds.length;i++){ds[i].classList.remove('dim','hot','warn','edge-active');}}
function storyShow(){
  var S=activeStories();var s=S[storyIdx];if(!s)return;
  NODES.forEach(function(n){var el=document.getElementById('arch2-node-'+n.id);if(el)el.classList.remove('h-done','h-todo','h-risk','h-merge');});
  var bar=document.getElementById('arch2-storyBar');
  bar.classList.toggle('warn-bar',!!s.warn);
  document.getElementById('arch2-storyStep').textContent=(storyIdx+1)+' / '+S.length+' · '+s.step;
  document.getElementById('arch2-storyText').textContent=s.text;
  document.getElementById('arch2-sPrev').disabled=(storyIdx===0);
  document.getElementById('arch2-sNext').textContent=(storyIdx===S.length-1)?'✓':'›';
  var onNodes={};(s.on||[]).forEach(function(id){onNodes[id]=1;});
  var warnNodes={};(s.warn||[]).forEach(function(id){warnNodes[id]=1;});
  // 點亮 on 節點，其餘淡出；warn 紅標
  NODES.forEach(function(n){var el=document.getElementById('arch2-node-'+n.id);if(!el)return;el.classList.remove('hot','dim','warn');
    if(warnNodes[n.id])el.classList.add('warn');
    else if(onNodes[n.id])el.classList.add('hot');
    else el.classList.add('dim');});
  // 點亮兩端都在 on 集合內的線
  EDGES.forEach(function(e,i){var p=document.getElementById('arch2-edge-'+i);var lab=document.getElementById('arch2-elabel-'+i);
    var on=onNodes[e.from]&&onNodes[e.to];
    if(p){p.classList.toggle('hot',!!on);p.classList.toggle('dim',!on);p.classList.toggle('edge-active',!!on);p.setAttribute('marker-end',on?'url(#arrH)':'url(#arr)');if(e.bi)p.setAttribute('marker-start',on?'url(#arrRH)':'url(#arrR)');}
    if(lab)lab.classList.toggle('dim',!on);});
}

// ── 視角切換：過濾(淡出非視角節點) + 換腳本 ──
function setView(v){
  curView=v;storyEnd();
  var pills=root.querySelectorAll('.vpill');
  for(var i=0;i<pills.length;i++)pills[i].classList.toggle('act',pills[i].getAttribute('data-view')===v);
  applyView();
}
function clearHealth(){root.classList.remove('health-on');NODES.forEach(function(n){var el=document.getElementById('arch2-node-'+n.id);if(el)el.classList.remove('h-done','h-todo','h-risk','h-merge');});}
function applyView(){
  clearDim();clearSel();clearHealth();
  if(curView==='health'){
    root.classList.add('health-on');
    positionMergeFrames();
    NODES.forEach(function(n){var el=document.getElementById('arch2-node-'+n.id);if(!el)return;el.classList.remove('dim');var h=HEALTH[n.id];if(h){el.classList.add('h-'+h.s);var hb=document.getElementById('arch2-hb-'+n.id);if(hb)hb.textContent=HEALTH_LBL[h.s];}});
    EDGES.forEach(function(e,i){var p=document.getElementById('arch2-edge-'+i);var lab=document.getElementById('arch2-elabel-'+i);if(p)p.classList.remove('dim');if(lab)lab.classList.remove('dim');});
    return;
  }
  if(curView==='all'){
    NODES.forEach(function(n){var el=document.getElementById('arch2-node-'+n.id);if(el)el.classList.remove('dim');});
    EDGES.forEach(function(e,i){var p=document.getElementById('arch2-edge-'+i);var lab=document.getElementById('arch2-elabel-'+i);if(p)p.classList.remove('dim');if(lab)lab.classList.remove('dim');});
    return;
  }
  var set={};(VIEWS[curView].nodes||[]).forEach(function(id){set[id]=1;});
  NODES.forEach(function(n){var el=document.getElementById('arch2-node-'+n.id);if(el)el.classList.toggle('dim',!set[n.id]);});
  EDGES.forEach(function(e,i){var on=set[e.from]&&set[e.to];var p=document.getElementById('arch2-edge-'+i);var lab=document.getElementById('arch2-elabel-'+i);if(p)p.classList.toggle('dim',!on);if(lab)lab.classList.toggle('dim',!on);});
}

function resetLayout(){NODES.forEach(function(n){n.x=DEFAULT_POS[n.id].x;n.y=DEFAULT_POS[n.id].y;var el=document.getElementById('arch2-node-'+n.id);if(el){el.style.left=n.x+'%';el.style.top=n.y+'%';}});refreshEdges();savePos();}
function exportLayout(){var p={};NODES.forEach(function(n){p[n.id]={x:Math.round(n.x*10)/10,y:Math.round(n.y*10)/10};});window.prompt('複製座標 JSON：',JSON.stringify(p));}
function importLayout(){var s=window.prompt('貼上座標 JSON：','');if(!s)return;try{var p=JSON.parse(s);NODES.forEach(function(n){if(p[n.id]){n.x=p[n.id].x;n.y=p[n.id].y;var el=document.getElementById('arch2-node-'+n.id);if(el){el.style.left=n.x+'%';el.style.top=n.y+'%';}}});refreshEdges();savePos();}catch(e){window.alert('JSON 格式錯誤');}}

loadPos();buildZones();buildMergeFrames();buildEdges();buildNodes();applyView();
/* ───── 現況示意：每節點對應自己的內部畫面（仿 drms_v4，假數據、無 fetch） ───── */
/* Line OA 標竿格：雙線架構 + 5 操作頁籤 + 規則 */
function viewLineOA(){
  return ''+
  '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">'+
    /* 左：手機框 Line OA 模擬 */
    '<div style="width:280px;flex-shrink:0;border:1px solid var(--border2);border-radius:16px;overflow:hidden;background:var(--bg2);box-shadow:var(--shadow-md)">'+
      '<div style="display:flex;align-items:center;gap:9px;padding:11px 13px;border-bottom:1px solid var(--border)">'+
        '<div style="width:30px;height:30px;background:#06C755;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:16px">💬</div>'+
        '<div style="flex:1"><div style="font-size:13px;font-weight:700;color:var(--text)">Line OA 總控</div><div style="font-size:9px;color:var(--text4);font-family:monospace">慈濟 DRMS · 官方帳號</div></div></div>'+
      '<div style="display:flex;border-bottom:1px solid var(--border)">'+
        ['📤 推播','✅ 報到','🚨 點名','🎯 派工','📦 物資'].map(function(t,i){return '<div style="flex:1;padding:7px 2px;text-align:center;font-size:9.5px;font-weight:'+(i===0?'700':'500')+';color:'+(i===0?'#06C755':'var(--text4)')+';border-bottom:2px solid '+(i===0?'#06C755':'transparent')+'">'+t+'</div>';}).join('')+'</div>'+
      '<div style="padding:13px;min-height:140px">'+
        '<div style="font-size:10px;color:var(--text3);margin-bottom:8px;font-weight:700">📤 推播訊息（示意）</div>'+
        '<div style="background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:10px;font-size:11px;color:var(--text2);line-height:1.6">🚨 花蓮光復鄉淹水<br>需要志工 30 名<br><span style="color:#06C755;font-weight:700">→ 點我報到</span></div>'+
        '<div style="display:flex;gap:6px;margin-top:9px"><div style="flex:1;text-align:center;background:#06C755;color:#fff;font-size:10px;font-weight:700;padding:7px;border-radius:7px">推播全體</div><div style="flex:1;text-align:center;background:var(--bg3);color:var(--text3);font-size:10px;font-weight:600;padding:7px;border-radius:7px">分眾</div></div>'+
      '</div>'+
      '<div style="background:#0F172A;padding:7px 11px;font-size:9px;color:#475569;font-family:monospace">＞ push 已送出 · 受眾 128</div>'+
    '</div>'+
    /* 右：雙線架構 + 規則 */
    '<div style="flex:1;min-width:260px">'+
      '<div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:10px">🔀 雙 Line 架構</div>'+
      '<div style="display:flex;flex-direction:column;gap:10px">'+
        '<div style="border:1px solid var(--blue-border);background:var(--blue-bg);border-radius:10px;padding:12px">'+
          '<div style="font-size:12px;font-weight:700;color:var(--blue)">🌐 對外志工線</div>'+
          '<div style="font-size:10.5px;color:var(--text2);margin-top:5px;line-height:1.7">QR → <code style="font-family:monospace;background:var(--bg);padding:1px 5px;border-radius:4px">doGet ?email=xxx</code><br>社區志工掃碼 → 帶 email 查詢報名 → 報到</div></div>'+
        '<div style="border:1px solid var(--accent-border);background:var(--accent-bg);border-radius:10px;padding:12px">'+
          '<div style="font-size:12px;font-weight:700;color:var(--accent)">🏛 對內慈誠線</div>'+
          '<div style="font-size:10.5px;color:var(--text2);margin-top:5px;line-height:1.7">QR → <code style="font-family:monospace;background:var(--bg);padding:1px 5px;border-radius:4px">?type=inner</code> → LIFF 彈窗<br>→ <code style="font-family:monospace;background:var(--bg);padding:1px 5px;border-radius:4px">doPost</code> 驗證「編號＋姓名」→ 報到</div></div>'+
      '</div>'+
      '<div style="margin-top:12px;font-size:12px;font-weight:800;color:var(--text);margin-bottom:6px">📐 運作規則</div>'+
      '<ul style="margin:0;padding-left:18px;font-size:10.5px;color:var(--text2);line-height:1.85">'+
        '<li>兩條獨立 GAS：對外 doGet、對內 doPost，各自部署 /exec 網址</li>'+
        '<li>對內需編號＋姓名雙重驗證，對外僅 email 查詢</li>'+
        '<li>報到後自動加入 OA → 後續收推播任務（點名/派工/物資）</li>'+
        '<li>5 操作面板：推播 · 報到 · 點名 · 派工 · 物資</li>'+
      '</ul>'+
    '</div>'+
  '</div>';
}

var PV_VIEWS={ lineoa: {title:'Line OA',render:viewLineOA} };

function pvPlaceholder(name){
  return '<div style="text-align:center;padding:50px 20px;color:var(--text3)">'+
    '<div style="font-size:34px;margin-bottom:12px">🚧</div>'+
    '<div style="font-size:14px;font-weight:700;color:var(--text2)">「'+name+'」這格的內部示意製作中</div>'+
    '<div style="font-size:11px;margin-top:8px;line-height:1.7">目前已完成標竿格：<b>Line OA</b>（雙線架構）<br>確認版型後將逐格補完其餘模組畫面</div></div>';
}
function pvShow(id,name){
  var v=PV_VIEWS[id];
  document.getElementById('arch2-pvTitle').textContent='現況示意　·　'+(name||(v&&v.title)||id);
  document.getElementById('arch2-pvBody').innerHTML=v?v.render():pvPlaceholder(name||id);
  document.getElementById('arch2-pvMask').classList.add('on');
}
function pvHide(){document.getElementById('arch2-pvMask').classList.remove('on');}

/* ───── 回饋提交碼（相容 intake INTAKE1 格式） ───── */
function fbEncode(obj){return "INTAKE1:"+btoa(unescape(encodeURIComponent(JSON.stringify(obj))));}
var _fbCode="";
function arch2_fbBuildNodeOptions_inner(){
  var sel=document.getElementById('arch2-fbNode');if(!sel)return;
  var opts='<option value="（整體）">（整體／不限特定模組）</option>';
  if(typeof NODES!=='undefined'){NODES.forEach(function(n){opts+='<option value="'+n.nm+'">'+n.nm+'</option>';});}
  sel.innerHTML=opts;
}
function fbT(){
  var p=document.getElementById('arch2-fbPanel');p.classList.toggle('on');
  if(p.classList.contains('on')&&!document.getElementById('arch2-fbNode').options.length)arch2_fbBuildNodeOptions_inner();
}
function fbFlash(m,err){var e=document.getElementById('arch2-fbFlash');e.textContent=m;e.style.color=err?'var(--red)':'var(--green)';setTimeout(function(){e.textContent='';},3500);}
function fbGenCode(){
  var nick=document.getElementById('arch2-fbNick').value.trim();
  var text=document.getElementById('arch2-fbText').value.trim();
  if(!text){fbFlash('請先填寫回饋內容',true);return;}
  var obj={kind:'feedback',nick:nick||'匿名',node:document.getElementById('arch2-fbNode').value,
    ftype:document.getElementById('arch2-fbType').value,text:text,ts:Date.now()};
  _fbCode=fbEncode(obj);
  document.getElementById('arch2-fbCode').textContent=_fbCode;
  document.getElementById('arch2-fbOut').classList.add('on');
  fbFlash('提交碼已產生，請複製傳出 ✓');
}
function fbCopy(){navigator.clipboard.writeText(_fbCode).then(function(){fbFlash('已複製提交碼 ✓');}).catch(function(){fbFlash('複製失敗，請手動選取',true);});}
function fbDownload(){var b=new Blob([_fbCode],{type:'text/plain;charset=utf-8'});var u=URL.createObjectURL(b);var a=document.createElement('a');a.href=u;a.download='回饋提交碼.txt';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u);fbFlash('已下載 ✓');}

document.addEventListener('keydown',function(e){if(e.key==='Escape')pvHide();});
window.arch2_storyStart=storyStart;
window.arch2_storyEnd=storyEnd;
window.arch2_storyPrev=storyPrev;
window.arch2_storyNext=storyNext;
window.arch2_resetLayout=resetLayout;
window.arch2_exportLayout=exportLayout;
window.arch2_importLayout=importLayout;
window.arch2_setView=setView;
window.arch2_pvHide=pvHide;
window.arch2_pvShow=pvShow;
window.arch2_fbT=fbT;
window.arch2_fbGenCode=fbGenCode;
window.arch2_fbCopy=fbCopy;
window.arch2_fbDownload=fbDownload;

})();
