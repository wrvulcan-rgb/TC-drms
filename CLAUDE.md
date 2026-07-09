# TC-drms 專案 CLAUDE 規則

## 部署規則（自動，不等指令）

**觸發：** 任何 `git push origin <feature-branch>` 完成後  
**動作：** 立刻串接執行：
```
git checkout main && git pull --rebase origin main && git merge <feature-branch> --no-edit && git push origin main
```
push feature branch ≠ 任務完成。merge to main 才是任務終點。

## 錯誤帳本

| 時間 | 錯誤 | 根本原因 | 修正 |
|------|------|----------|------|
| 2026-06-29 | push feature branch 後未自動 merge main | 把 push 當終點，未串接部署規則 | 部署規則列為 push 後必接步驟 |
| 2026-07-09 | 除儀表板外所有分頁點開全空白 | 7fef365 清殘留標籤時整行刪除，行內含 w-sim 結構必要的兩個 `</div>`，其餘分頁全被巢狀進隱藏的儀表板內 | 補回兩個 `</div>`；日後改 HTML 需驗證 div 開關配對平衡 |
