// 錄製 index.html 動畫為 webm（1280x720）。用法：NODE_PATH=$(npm root -g) node record.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const outDir = path.join(__dirname, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: outDir, size: { width: 1280, height: 720 } },
  });
  const page = await ctx.newPage();
  await page.goto('file://' + path.join(__dirname, 'index.html'));
  await page.waitForFunction('window.__VIDEO_DONE__ === true', null, { timeout: 120000 });
  const video = page.video();
  await ctx.close(); // 關閉才會 flush 影片
  const tmp = await video.path();
  const dest = path.join(__dirname, 'loa_intro.webm');
  fs.renameSync(tmp, dest);
  await browser.close();
  console.log('SAVED ' + dest);
})();
