// Records the 6h recap (3 minutes) of the live autopilot page. Run by .github/workflows/recap.yml
import { chromium } from 'playwright';
import fs from 'fs';
fs.mkdirSync('rec', { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: 'rec', size: { width: 1280, height: 720 } } });
const p = await ctx.newPage();
await p.goto('https://desk-agent.netlify.app/autopilot.html?recap=auto&t=' + Date.now(), { waitUntil: 'networkidle' });
await p.waitForSelector('#recapMsg:has-text("recording")', { timeout: 60000 });
await p.waitForTimeout(190000);
await ctx.close(); await b.close();
