// v1.13: one coin per run, every 15 minutes. Picks BTC, coins with an open trade, or the biggest 24h movers whose last scan is over 2 hours old.
import { newsJob, pickNewsCoin } from '../lib/ap.mjs';
export default async () => {
  try {
    const coin = await pickNewsCoin(process.env);
    if (!coin) return new Response('nothing due');
    const r = await newsJob(process.env, coin); console.log(coin, JSON.stringify(r)); return new Response(JSON.stringify(r));
  } catch (e) { console.log('news scan error', String(e.message || e)); return new Response('error', { status: 500 }); }
};
// Scheduled run disabled 18 Oct 2026 (autopilot-ai runs the news scan).
