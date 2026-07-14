#!/usr/bin/env node
// 語法檢查（只編譯不執行）。用 vm.Script 而非 `node --check`，
// 因為 node --check 會依副檔名把 gas/*.gs 當成 ESM 而拋 ERR_UNKNOWN_FILE_EXTENSION。
// vm.Script 讀檔內容當傳統 script 編譯，副檔名無關，正好覆蓋 app.js / arch-*.js / gas/*.gs。
const fs = require('fs');
const vm = require('vm');

const files = process.argv.slice(2);
if (!files.length) {
  console.error('用法：node scripts/check-syntax.js <file> [file...]');
  process.exit(2);
}

let bad = 0;
for (const f of files) {
  try {
    new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f });
    console.log('  ✓ ' + f);
  } catch (e) {
    console.error('  ✗ ' + f + '：' + e.message);
    bad++;
  }
}
process.exit(bad ? 1 : 0);
