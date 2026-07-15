# 慈濟文稿自動化架構

## 1. 設計原則

### 1.1 事實優先

文稿是 TC-DRMS 事實資料的衍生物，不是第二份真相。所有可驗證敘述應具備：

```text
value
source_entity
source_id
source_field
captured_at
verified_by
verified_at
privacy_level
publication_consent
```

模型只能重新組織已核准事實，不能把推測轉成陳述句。

### 1.2 人物尊嚴優先於戲劇性

- 受助者是具有選擇與行動能力的人，不是用來襯托組織善行的道具。
- 苦難細節只保留理解事件所需的最低限度。
- 不以「可憐、無助、悲慘」代替可觀察事實。
- 健康、財務、家庭與住址資訊採最小揭露。
- 人名、影像與直接引言需個別取得公開同意。

### 1.3 文體分流

不得用單一模板生成所有文章。

| 模式 | 核心問題 | 建議篇幅 | 必要素材 |
|---|---|---:|---|
| breaking-news | 現在發生什麼、影響誰、下一步 | 350–700 字 | 5W1H、行動、數字、窗口 |
| disaster-relief | 災情、評估、行動、人物、後續 | 900–1,600 字 | 災情來源、任務、發放、人物引言 |
| community-record | 為何做、如何做、誰參與、留下什麼 | 900–1,800 字 | 活動因緣、流程亮點、人物觀點 |
| medical-outreach | 醫療需求、服務、專業角色、受益影響 | 800–1,500 字 | 醫療服務、醫護核准說法、受惠者同意 |
| person-profile | 人物處境、選擇、行動、轉變 | 1,200–2,200 字 | 多次訪談、時間線、原話、旁證 |
| ceremony-dharma | 儀式、因緣、參與、體悟 | 800–1,500 字 | 儀式名稱、法義來源、參與者原話 |
| photo-caption | 圖中誰、做什麼、何時何地 | 35–90 字 | 照片內容、人物同意、攝影者 |

### 1.4 人工核准

系統可以產生草稿、問題清單與檢查結果，但不能自行變更為 `approved` 或 `published`。

## 2. Domain Model

```text
ManuscriptProject
├── id
├── event_id
├── mode
├── status
├── title_candidates[]
├── selected_title
├── fact_package_id
├── outline
├── draft_versions[]
├── validation_runs[]
├── reviewers[]
├── approval
└── publication_record

FactPackage
├── facts[]
├── people[]
├── quotations[]
├── media[]
├── unresolved_questions[]
├── consent_records[]
└── snapshot_hash

Fact
├── id
├── kind
├── value
├── unit
├── source_entity
├── source_id
├── source_field
├── confidence
├── verified_by
├── verified_at
├── privacy_level
└── publishable

Quotation
├── speaker_person_id
├── exact_text
├── source_type
├── source_reference
├── captured_at
├── transcript_verified
├── publication_consent
└── allowed_edits

DraftVersion
├── version
├── content
├── generated_from_snapshot_hash
├── generated_at
├── model_or_editor
├── changed_fact_ids[]
└── validation_status
```

## 3. 與 TC-DRMS Event Fabric 的整合

文稿模組只訂閱經核准事件：

```text
EventVerified
CasePublicationConsentGranted
TaskCompletedAndVerified
InventoryDistributionReconciled
FundAssistanceApprovedForPublication
InterviewTranscriptVerified
MediaCaptionVerified
```

不訂閱或不得輸出的事件：

```text
CaseCreated
CaseSuspected
MedicalNoteAdded
FundApplicationSubmitted
InventoryEstimateUpdated
UnverifiedFieldReportReceived
```

### 3.1 Fact Package Reducer

```text
verified event arrives
→ confirm permission and consent
→ normalize value and unit
→ attach source reference
→ calculate snapshot hash
→ append fact without editing source entity
→ mark unresolved conflicts
```

同一數字若出現多個來源，不取最大值或最新值自動覆蓋；應標示衝突並要求人工選定口徑。

## 4. 志工操作流程

### Step 1：選擇事件或活動

志工由既有 Event／Task 選取，不手動重打一份事件資料。

### Step 2：系統預填可用事實

預填：日期、地點、活動名稱、任務、團隊、已覆核人數、物資數量、後續行動。

### Step 3：補充現場素材

志工只需要補：

- 一個最具代表性的現場畫面。
- 一至三段經同意的直接引言。
- 事件因緣或前情。
- 人物如何參與、選擇或改變。
- 照片的客觀描述與攝影者。

### Step 4：缺口檢查

系統產生待補問題，不產生虛構答案。例如：

```text
[待補] 發放戶數在 Task 與 Inventory 對帳結果不同。
[待補] 受訪者尚未確認姓名是否公開。
[待補] 引言只有轉述，沒有錄音或逐字筆記。
```

### Step 5：產生大綱與草稿

先產生段落功能，再填入內容：

```text
導言：日期／地點／事件／主要行動／影響
背景：因緣、問題或災情
行動：誰做了什麼、如何合作
人物：具體處境、行動、直接引言
結果：核准數字與實際改變
後續：下一步與持續關懷
```

### Step 6：五道檢查

1. **事實檢查**：所有人名、日期、數字、地點與引言有來源。
2. **稱謂與術語檢查**：職稱、法號、組織、慈濟專詞使用正確。
3. **隱私與尊嚴檢查**：同意、個資、醫療與家庭資訊符合最低揭露。
4. **敘事品質檢查**：有主題、轉折與具體畫面，不是流水帳。
5. **AI 腔檢查**：抽象價值詞密度、重複句式、空泛結尾不超標。

### Step 7：人工編審與發布

至少需要：

- 事實覆核者。
- 文稿編輯者。
- 涉及 Case 或醫療資訊時的隱私覆核者。
- 具發布權限者。

小型圖說可合併角色，但不得由草稿產生者單獨完成全部核准。

## 5. 標題生成

標題候選必須先抽取文章最具體的：

```text
action
person
scene
impact
turning_point
```

再從下列模式生成，最多提供五個候選：

```text
行動＋成果
困境＋回應
具體畫面＋精神意義
人物＋生命轉變
活動名稱＋主題
事實層＋價值層雙句
```

### 禁止標題

- 只有「愛、希望、溫暖、感恩、圓滿」而沒有事件。
- 放大未證實災情。
- 使用受訪者未同意公開的病況、身分或家庭困境。
- 將預計成果寫成已完成成果。

## 6. 直接引言規則

引言必須：

- 來自錄音、逐字稿或現場筆記。
- 保留原意，不把轉述加上引號。
- 標示說話者與情境。
- 經受訪者或負責志工確認可公開。
- 不從公開語料複製到新人物身上。

允許修正口頭贅詞與明顯語病，但不得增加人物未說過的價值判斷。

## 7. 權限模型

| 動作 | reporter | editor | fact_approver | privacy_reviewer | publisher |
|---|---:|---:|---:|---:|---:|
| 建立專案 | ✓ | ✓ |  |  |  |
| 補充素材 | ✓ | ✓ |  |  |  |
| 產生草稿 | ✓ | ✓ |  |  |  |
| 修改敘事 |  | ✓ |  |  |  |
| 核准事實 |  |  | ✓ |  |  |
| 核准敏感內容 |  |  |  | ✓ |  |
| 核准發布 |  |  |  |  | ✓ |
| 發布／撤稿 |  |  |  |  | ✓ |

## 8. API 邊界（未實作）

```text
POST   /api/manuscripts
POST   /api/manuscripts/{id}/facts/import
POST   /api/manuscripts/{id}/materials
POST   /api/manuscripts/{id}/outline
POST   /api/manuscripts/{id}/drafts
POST   /api/manuscripts/{id}/validate
POST   /api/manuscripts/{id}/submit-review
POST   /api/manuscripts/{id}/approve
POST   /api/manuscripts/{id}/publish
GET    /api/manuscripts/{id}/provenance
```

所有生成與驗證請求都要帶 `fact_package_snapshot_hash`，避免來源更新後仍發布舊稿。

## 9. 漸進式落地

### Phase 0：知識層

- 500 篇公開文稿衍生特徵。
- 詞庫、文體、模板與檢查規則。
- 不接觸真實個案資料。

### Phase 1：志工採訪表＋大綱

- 由志工輸入 JSON／表單。
- 系統檢查缺口並產生大綱。
- 不生成完整文章。

### Phase 2：受控草稿

- 依事實包生成草稿。
- 每一段顯示來源事實。
- 人工編審後匯出 Markdown／DOCX。

### Phase 3：TC-DRMS 原生整合

- 從 Event／Task／Inventory 等資料預填。
- 加入角色權限、同意紀錄與審核軌跡。
- 仍不自動發布。

### Phase 4：發布工作流

- 對接核准的慈濟內容平台。
- 支援撤稿、版本、來源與公開紀錄。
- 需另行安全、法務與組織流程驗收。

## 10. 驗收條件

- 原有 TC-DRMS 操作流程零變動。
- 文稿模組可獨立停用。
- 缺少必要事實時只能輸出待補，不得補寫。
- 每個數字與直接引言可追溯。
- 未同意公開的人物資料不進草稿。
- 專業詞與價值詞分開管理。
- 文章通過五道檢查後仍需人工核准。
