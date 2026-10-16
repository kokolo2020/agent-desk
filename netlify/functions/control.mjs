// PIN-protected control for the paper desks. POST { pin, action: 'get' | 'set', state }.
// The PIN lives only in the CONTROL_PIN environment variable. 5 wrong tries lock it for 15 minutes.
import { timingSafeEqual } from 'node:crypto';
import { sb, loadControl, saveControl } from '../lib/ap.mjs';
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const DESKS = ['ai', 'n', 's', 'u', 'm', 'g', 'algo', 'algo2', 'algo3', 'algoq', 'algow', 'algox', 'rev'];
const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const origin = req.headers.get('origin') || '';
  if (origin && !/auto-pilotai\.netlify\.app$/.test(new URL(origin).host)) return json({ error: 'origin' }, 403);
  let b; try { b = await req.json(); } catch (e) { return json({ error: 'bad request' }, 400); }
  const env = process.env;
  if (!env.CONTROL_PIN || !env.SUPABASE_SERVICE_KEY) return json({ error: 'not configured' }, 500);
  const db = sb(env.SUPABASE_SERVICE_KEY), ctl = await loadControl(db), now = Date.now();
  ctl.fails = (ctl.fails || []).filter((t) => now - t < 15 * 60000);
  if (ctl.fails.length >= 5) return json({ error: 'locked', retryMin: Math.ceil((15 * 60000 - (now - ctl.fails[0])) / 60000) }, 429);
  if (!same(String(b.pin || ''), String(env.CONTROL_PIN))) { ctl.fails.push(now); await saveControl(db, ctl); return json({ error: 'wrong pin', triesLeft: 5 - ctl.fails.length }, 401); }
  let dirty = ctl.fails.length > 0; ctl.fails = [];
  if (b.action === 'set' && b.state && typeof b.state === 'object') {
    const st = b.state;
    ctl.paused = !!st.paused;
    ctl.off = {}; for (const k of DESKS) if (st.off && st.off[k]) ctl.off[k] = true;
    ctl.coinsOff = {}; for (const k of Object.keys(st.coinsOff || {})) if (/^[A-Z0-9]{2,12}$/.test(k) && st.coinsOff[k]) ctl.coinsOff[k] = true;
    ctl.lossLimit = Math.max(0, Math.min(5000, Math.round(+st.lossLimit || 0)));
    ctl.updated = now; dirty = true;
  }
  if (dirty) await saveControl(db, ctl);
  return json({ ok: true, state: { paused: ctl.paused, off: ctl.off, coinsOff: ctl.coinsOff, lossLimit: ctl.lossLimit, updated: ctl.updated } });
};
