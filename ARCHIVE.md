# ARCHIVE — 封存索引（藏寶圖）

封存原則（Mason 2026-07-04 裁決）：檔案本體移出工作目錄——任何程序（build/搜尋/AI session）不再讀到；
git 歷史永久保留本體，還原一行指令。**看到本檔＝這些檔案沒有消失，只是零接觸封存。**

## 錨點
- 封存錨 commit：`bb12fc831df4cde078df9ac8587319fce86af8eb`（四檔最後存在的 commit）
- 本機 tag `archive/pre-split-2026-07-04` 指向同一 commit（本 session 環境無法 push tag；
  Mason 可在本機補推：`git tag -a archive/pre-split-2026-07-04 bb12fc8 -m 封存 && git push origin --tags`）
- ⚠️ 錨點永久有效的前提：`claude/workflow-optimization-pxwef6` 分支要 merge 進 main（或分支不刪）。

## 封存清單
| 檔案 | 封存原因 | 還原指令 |
|---|---|---|
| `drms_v4.html` | 早期原型，2026-06-10 後停更；非現行主線依賴 | `git checkout bb12fc8 -- drms_v4.html` |
| `index_v4.0_20260622.html` | 拆檔母本（因單檔過大拆成現行 index.html 模組架構），歷史快照 | `git checkout bb12fc8 -- index_v4.0_20260622.html` |
| `arch-script.js.bak` | 手動備份殘留，落後正本一個 commit | `git checkout bb12fc8 -- arch-script.js.bak` |
| `arch-style.css.bak` | 手動備份殘留，與正本僅差 4 行 | `git checkout bb12fc8 -- arch-style.css.bak` |

只想看內容不還原檔案：`git show bb12fc8:drms_v4.html`（其餘檔名同理）。
新增封存時：先確認檔案在 HEAD 存在 → 記下 SHA → `git rm` → 本表加一列。
