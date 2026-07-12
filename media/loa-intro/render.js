// 逐格確定性渲染：讀 out/timeline.json，用 Web Animations API 把每一幀定格後截圖，
// PNG 串流進 ffmpeg 產出無聲 mp4（音畫由同一份 timeline 對齊，零漂移）。
// 用法：FFMPEG_BIN=<ffmpeg路徑> NODE_PATH=$(npm root -g) node render.js
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const TL = JSON.parse(fs.readFileSync(path.join(__dirname, 'out/timeline.json'), 'utf8'));
const FF = process.env.FFMPEG_BIN;
if (!FF) { console.error('need FFMPEG_BIN'); process.exit(1); }
const OUTV = path.join(__dirname, 'out/video_silent.mp4');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('file://' + path.join(__dirname, 'index.html') + '?render=1');
  await page.waitForLoadState('load');

  const ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe',
    '-framerate', String(TL.fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
    OUTV], { stdio: ['pipe', 'inherit', 'inherit'] });

  const totalFrames = Math.ceil(TL.total * TL.fps);
  for (let fidx = 0; fidx < totalFrames; fidx++) {
    const t = fidx / TL.fps;
    await page.evaluate(({ t, starts, fadeStart }) => {
      const scenes = [...document.querySelectorAll('.scene')];
      let k = 0;
      for (let i = 0; i < starts.length; i++) if (t >= starts[i]) k = i;
      scenes.forEach((s, i) => s.classList.toggle('active', i === k));
      document.querySelectorAll('.progress i').forEach((d, i) => d.classList.toggle('on', i === k));
      document.getElementById('stage').classList.toggle('fade-out', t >= fadeStart);
      document.getAnimations().forEach(a => {
        a.pause();
        const eff = a.effect;
        if (!eff || !eff.target) return;
        let base = 0; // 全域裝飾動畫用全片時間
        if (eff.pseudoElement === '::after') base = fadeStart; // 片尾淡出
        else {
          const sc = eff.target.closest && eff.target.closest('.scene');
          if (sc) base = starts[scenes.indexOf(sc)]; // 景內動畫用景相對時間
        }
        a.currentTime = Math.max(0, t - base) * 1000;
      });
    }, { t, starts: TL.starts, fadeStart: TL.fadeStart });
    const buf = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (fidx % 150 === 0) console.log(`frame ${fidx}/${totalFrames}`);
  }
  ff.stdin.end();
  await new Promise((res, rej) => { ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))); });
  await browser.close();
  console.log('SILENT VIDEO ' + OUTV);
})().catch(e => { console.error(e); process.exit(1); });
