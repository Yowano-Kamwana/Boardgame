// Records one shot of tools/film/film.html as numbered JPEG frames, driving the page's virtual clock.
// usage: node capture.mjs <shot> <ms> <outDir> [fps=24] [q=high] [w=1280] [h=720]
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
const [shot, ms, out, fps = '24', q = 'high', w = '1280', h = '720'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'], proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
const page = await (await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(`http://localhost:8765/tools/film/film.html?q=${q}`);
for (let i = 0; i < 480 && !(await page.evaluate(() => !!window.filmReady)); i++) await new Promise((r) => setTimeout(r, 250));
await page.evaluate(([n, m]) => window.film.start(n, +m), [shot, ms]);
const dt = 1000 / +fps;
// setup: let the board build and figures load (real time), discarding these frames
const setupSteps = shot === 'heroes' ? 0 : Math.round(2600 / dt);
for (let i = 0; i < setupSteps; i++) { await page.evaluate((d) => window.__step(d), dt); if (i % 10 === 0) await page.waitForLoadState('networkidle').catch(() => {}); }
await new Promise((r) => setTimeout(r, 1500));
const total = Math.round(+ms / dt);
const t0 = Date.now();
for (let f = 0; f < total; f++) {
  // the gallery loads each figure on demand: hold the clock until it has arrived
  for (let k = 0; k < 100; k++) { const loading = await page.evaluate(() => { const l = document.querySelector('.g-load'); return !!l && !l.hidden; }); if (!loading) break; await new Promise((r) => setTimeout(r, 200)); }
  await page.evaluate((d) => window.__step(d), dt);
  await page.screenshot({ path: `${out}/f${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 90 });
  if (f % 48 === 0) console.log(shot, f, '/', total, ((Date.now() - t0) / (f + 1)).toFixed(0), 'ms/frame');
}
const err = await page.evaluate(() => window.film.error);
if (err) console.log('FILM ERROR', err);
await browser.close();
console.log('done', shot, total, 'frames');
