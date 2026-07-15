# AI Handoff Card

> Repository: `wrvulcan-rgb/TC-drms`
> Project context: TC-DRMS / Disaster Operating System 專案。
> Purpose: 在 Claude、Codex、ChatGPT 與 Mason 之間保存「目前任務的可執行狀態」。本檔不是完整聊天日記，也不保存私人推理過程。

## 0. Control

- Status: `IDLE`
- Task ID: `NONE`
- Owner: `NONE`
- Next agent: `NONE`
- Last updated: `2026-07-15`
- Updated by: `ChatGPT`

Allowed status values:

- `IDLE`: 沒有進行中任務
- `DRAFT`: 任務仍在定義
- `READY_FOR_CLAUDE`: 等待 Claude 分析、規劃或審查
- `READY_FOR_CODEX`: 等待 Codex 實作、測試或 repo 操作
- `IN_PROGRESS_CLAUDE`: Claude 正在處理
- `IN_PROGRESS_CODEX`: Codex 正在處理
- `BLOCKED`: 有明確阻礙，需列出解除條件
- `REVIEW_REQUIRED`: 實作完成，等待另一代理或 Mason 驗收
- `DONE`: 已完成並有驗證證據

## 1. Goal

`NONE`

Describe the single outcome this task must produce. Do not list unrelated improvements.

## 2. Verified Context

- Relevant files or paths: `NONE`
- Existing behavior: `NONE`
- Decisions already fixed: `NONE`
- External references: `NONE`

Only record facts that were verified from the repository, connected source, test output, or Mason's explicit instruction.

## 3. Scope

### Must change

- `NONE`

### May change

- `NONE`

### Must not change

- `NONE`

## 4. Acceptance Criteria

- [ ] Goal is satisfied.
- [ ] Requested scope only; no unrelated refactor.
- [ ] Existing data and behavior are preserved unless explicitly authorized.
- [ ] Relevant tests or checks were actually run where execution is available.
- [ ] Evidence and remaining risks are recorded below.

Add task-specific acceptance criteria above these default checks.

## 5. Assumptions and Unknowns

- Assumptions: `NONE`
- Unknowns that could change the implementation: `NONE`
- How each unknown will be verified: `NONE`

Do not silently convert an unknown into a fact.

## 6. Work Completed

`NONE`

Record only material actions, files changed, decisions made, and why. Do not paste full conversation history.

## 7. Verification Evidence

- Tests/checks run: `NONE`
- Result: `NONE`
- Evidence links, commit, PR, issue, or output: `NONE`
- Checks not run and reason: `NONE`

Never write “should work” as verification.

## 8. Risks and Unresolved Items

- Risks: `NONE`
- Blockers: `NONE`
- Follow-up items outside current scope: `NONE`

## 9. Next Action

- Next agent: `NONE`
- Exact action: `NONE`
- Required inputs: `NONE`
- Stop condition: `NONE`

The next agent must be able to act from this section without rereading the full conversation.

## 10. Final Result

- Outcome: `NONE`
- Acceptance: `NOT REVIEWED`
- Final status: `IDLE`
- Approved by: `NONE`

## 11. Agent Update Contract

Every agent using this file must:

1. Read repository-level instructions before acting, including `CLAUDE.md`, `AGENTS.md`, `CODEX.md`, README files, and relevant skills when present.
2. Confirm that the card describes one active task. Split unrelated work into separate tasks rather than expanding scope.
3. Before work, set `Owner`, `Status`, `Last updated`, and the intended `Next agent`.
4. Preserve Mason's explicit decisions and the `Must not change` boundary.
5. Update the card after material progress, not after every minor action.
6. Record evidence from actual repository inspection, tests, checks, commits, PRs, or source data.
7. Never store API keys, passwords, tokens, personal secrets, raw email contents, or sensitive personal data here.
8. Never include hidden chain-of-thought. Record concise conclusions, evidence, assumptions, and decisions only.
9. Do not mark `DONE` until acceptance criteria are checked and remaining risks are stated.
10. Do not merge, deploy, publish externally, delete data, or overwrite existing work unless Mason explicitly authorized that action.

## 12. Completion and Archive Rule

When a task is complete:

1. Fill `Final Result` and all verification fields.
2. Set `Status: DONE`.
3. Preserve a concise completed-task record under `docs/handoffs/YYYY-MM-DD-<task-id>.md` only when the decision or implementation will matter later.
4. Reset this card to `IDLE` before starting the next unrelated task.
5. Promote durable decisions to the repository's canonical decision or architecture documentation; do not leave long-term knowledge only in this temporary card.
