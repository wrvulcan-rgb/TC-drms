# TC-DRMS 慈濟文稿自動化模組

本模組把 TC-DRMS 已驗證的現場資料整理成可供志工編寫、審閱與留史的文稿草稿。它不是自由寫作機，也不直接發布內容。

## 目標

1. 降低志工從活動資料、任務回報、照片與訪談筆記整理文稿的時間。
2. 保留慈濟人文真善美的事實性、人物溫度、專業稱謂與敘事節奏。
3. 讓每一句可驗證敘述都能追溯到 Event、Case、Task、Person、Squad、Inventory、Fund、Feedback 或人工訪談來源。
4. 把個資、尊嚴、錯誤稱謂、虛構引言與 AI 套話擋在人工編審之前。

## 明確不做

- 不從不足資料推測人物心理、信仰、家庭關係、病況或受災程度。
- 不自行創造人名、日期、地點、數字、職稱、法號、引言與照片內容。
- 不把公開文章中的句子或引言搬到新稿。
- 不保存官方文章全文；只保存來源索引、正文雜湊與衍生風格特徵。
- 不自動對外發布；發布必須由具權限的人員人工核准。
- 不修改 TC-DRMS 的 operational source of truth；文稿只讀取核准快照。

## 資料流

```text
Event / Case / Task / Person / Squad / Inventory / Fund / Feedback
                              │
                              ▼
                    Verified Fact Package
          （欄位值＋來源 ID＋核准者＋隱私等級＋時間）
                              │
                              ▼
                     Manuscript Mode Router
                              │
              ┌───────────────┼────────────────┐
              ▼               ▼                ▼
          災難救援稿       社區大藏經稿       人物故事稿
          醫療義診稿       宗教活動稿         圖說／短稿
              └───────────────┼────────────────┘
                              ▼
                         Draft Outline
                              ▼
                       Assisted Drafting
                              ▼
        事實 → 稱謂／術語 → 隱私尊嚴 → 敘事品質 → AI 腔
                              ▼
                         Human Review
                              ▼
                    Approved / Published
```

## 與 TC-DRMS 核心實體的對應

| 來源實體 | 可提供的文稿事實 | 禁止直接輸出的內容 |
|---|---|---|
| Event | 災害名稱、時間窗、地點、事件背景 | 未核准的情資與推測原因 |
| Case | 需求類型、處理狀態、已同意公開的故事 | 身分證、電話、地址、健康細節、未同意姓名 |
| Task | 志工行動、完成時間、成果、回報 | 未完成或未覆核的成果 |
| Person | 已同意公開的姓名、角色、直接引言 | 私人聯絡資訊、內部評語 |
| Squad | 團隊名稱、功能、合作方式 | 未核准的人員名冊 |
| Inventory | 核准發放品項與數量 | 預估量、重複計數、內部庫存敏感資訊 |
| Fund | 已核准的援助類型與公開金額 | 審核中的個案金額或金融資料 |
| Feedback | 現場觀察、照片描述、受訪紀錄 | 作者推測的心理與未標來源文字 |

## 目錄

```text
manuscript/
├── README.md
├── architecture.md
├── knowledge/
│   ├── editorial-style.md
│   ├── terminology.yaml
│   └── generated/
│       ├── corpus-manifest.jsonl
│       ├── corpus-stats.json
│       └── training-report.md
├── schemas/
│   └── volunteer-report.schema.json
├── templates/
│   ├── disaster-relief.md
│   ├── medical-outreach.md
│   └── community-record.md
├── validators/
│   └── rules.json
└── examples/
    └── volunteer-report.sample.json
```

## 文稿狀態

```text
collecting
→ fact_check
→ ready_for_draft
→ drafting
→ editorial_review
→ privacy_review
→ approved
→ published
→ archived
```

任何檢查失敗時回到 `collecting` 或 `drafting`，不得跳過核准直接發布。

## 志工最小輸入

志工不需要先寫文章，只要回答：

1. 何時、何地、發生什麼事？
2. 為什麼展開這次行動？
3. 哪些團隊做了哪些具體工作？
4. 有哪些經覆核的數字與成果？
5. 哪一位人物願意受訪與公開？
6. 他／她的原話是什麼？是否有錄音或筆記？
7. 照片中客觀可見的內容是什麼？
8. 下一步行動或持續關懷是什麼？

缺少的事實應標示 `[待補]`，禁止由模型補齊。

## 語料計數規則

一篇文章只有同時符合下列條件才計入：

- URL 或文章 ID 未重複。
- 有作者與文章日期。
- 成功取得可分析正文，純標題與分類索引不計。
- 正文至少 320 個非空白字元。
- 正文雜湊未與其他文章重複。

A 級代表較完整的正文與段落結構；B 級代表正文較短但仍可分析。兩者分開揭露。
