# 通用知識（母艦 exports — 跨專案可用的概念索引，勿在子 repo 手改）

> 來源：mason-claude-memory/knowledge-base.md 的跨專案通用部分。**本檔是生成物**（生成日 2026-08-01）：知識本體以 knowledge-base.md 為準，改源後照 maintenance.md §2 第 5 步重新導出。只放索引行，細節回母艦查。

- **Context Engineering**：為 LLM 設計「什麼資訊、在哪個時機、用什麼格式」進 context 的工程紀律。擴展任何 repo 的制度時以此為設計原則——問「這資訊要在哪個時機進 context」而非「要不要加」。
- **Superpowers 方法論**：Brainstorm → Plan → Implement → Review 四段強制結構，防止直接跳入實作。複雜需求說「用 Superpowers 流程」即套用。
- **Data Contract**：上下游資料交換協議（schema＋品質＋SLA）。接上游資料時要求對方提供 contract，取代口頭說明。
- **驗證不自驗**：做的人不驗自己的產出，驗收派 fresh-context subagent，只給「驗收條件＋產出路徑」，不給實作過程。
- **邊做邊存（checkpointing）**：工作方向改變或 session 將結束時把狀態寫回載體 → push，跨 session 交接靠留痕不靠記憶。（2026-07-24 修正：原文寫「更新 handoff.md」已過期——handoff/backlog/exchange 已凍結禁寫新任務，跨 AI 狀態唯一載體＝GitHub Issues）
- **Thinking Orbs／AI 處理狀態**：以具情境感的動態狀態呈現 AI 正在處理，改善等待體驗；不得把視覺回饋當成真實效能或能力證據。
- **Fable 5 第二大腦案例（待驗）**：目前只保留研究線索；採用前必須補齊原始流程、資料來源、可重現步驟與輸出證據。
- **AI Agent Loop 四類框架**：以 Turn-based、Goal-based、Time-based、Proactive 分類 Agent 迴圈，並補觸發、停止、留痕與人工核准條件。
