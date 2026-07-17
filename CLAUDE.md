# TC-drms 專案 CLAUDE 規則

## 專案定位（2026-07-17 Mason 確認，權威優先於任何舊文件）

TC-drms 是功能／骨架測試沙盒，**不是**要推上線的正式產品。慈濟災害應變中心的正式頁面範例由學長（pichiu／joeyuping 帳號下的 `disaster-response-center`）各自維護，鐵律是不得修改他們的東西（見母艦 `errors.md` 已內化鐵律）。
分支 `docs/v4.1-prepilot-handoff` 上的 `CLAUDE_HANDOFF_V4.1_PREPILOT.md`（ChatGPT 撰寫，主張把 TC-drms 當正式產品推 Pre-Pilot）與此定位矛盾，**已被本節取代作廢**；該分支未合併 main，若之後有 session 撿到該分支接手任務，先看本節，不要照該文件的框架執行。

# 開場（每個 session，順序固定）
1. 讀 `.claude/shared/iron-laws.md`（全局鐵律）＋ `.claude/shared/core-rules.md`（通用行為規則）。
2. 讀本 repo `errors.md` 最近 10 筆。
3. 優先權：本檔 > .claude/shared/*（本檔有專案特定理由時以本檔為準）。

## 部署規則（自動，不等指令）

**觸發：** 任何 `git push origin <feature-branch>` 完成**且驗收通過**後（驗收＝該次改動的自檢/測試實際跑過，非「應該沒問題」；2026-07-10 Mason 裁決甲案，對齊母艦 git-workflow）
**動作：** 立刻串接執行：
```
git checkout main && git pull --rebase origin main && git merge <feature-branch> --no-edit && git push origin main
```
push feature branch ≠ 任務完成。merge to main 才是任務終點。
**例外：** session 被指定只能 push 特定分支時（雲端 session 的 Git Development Branch 指示），不執行自動 merge，改在回報末尾標「待 merge to main」。

## 錯誤帳本

錯誤 → 寫 `errors.md`（格式見該檔開頭；標 🌐 通用的教訓會由聯邦同步回流母艦）。

# 聯邦
母艦：github.com/wrvulcan-rgb/mason-claude-memory
`.claude/shared/` 由母艦聯邦同步覆蓋，勿手改；要改通用規則去母艦改。
