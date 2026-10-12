// LLM Chief: asks Claude whether a paper trade proposed by the desk should go ahead.
// Needs the env var ANTHROPIC_API_KEY (set in Netlify, never in the repo).
const SYSTEM = 'You are CHIEF, the decision agent of a PAPER trading desk (no real money). Fees are 0.11% round trip, take profit +0.40%, stop -0.20%, max hold 15 minutes, 5x leverage. Decide whether to open a LONG, a SHORT, or PASS right now, using only the data given. Pass unless the expected move clearly exceeds fees and the recent trades do not show the same setup failing. Reply with ONLY compact JSON: {"action":"LONG"|"SHORT"|"PASS","confidence":0..1,"reason":"max 140 chars"}';
const hits = [];
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const origin = req.headers.get('origin') || req.headers.get('referer') || '';
  if (!/desk-agent\.netlify\.app|localhost/.test(origin)) return json({ error: 'origin' }, 403);
  const key = (process.env.ANTHROPIC_API_KEY || '').trim().replace(/^["']|["']$/g, '');
  if (!key) return json({ error: 'ANTHROPIC_API_KEY not set' }, 500);
  const now = Date.now();
  while (hits.length && now - hits[0] > 60000) hits.shift();
  if (hits.length >= 12) return json({ error: 'rate limit' }, 429);
  hits.push(now);
  let body;
  try { body = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  if (!body || !body.coin || !body.market) return json({ error: 'missing fields' }, 400);
  const prompt = 'Coin: ' + String(body.coin).slice(0, 10) + '\nMarket snapshot (JSON): ' + JSON.stringify(body.market).slice(0, 3000) + '\nRecent closed paper trades (JSON): ' + JSON.stringify(body.history || []).slice(0, 2000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 1500, system: SYSTEM, messages: [{ role: 'user', content: prompt }] })
    });
    if (!r.ok) return json({ error: 'anthropic ' + r.status, key_len: key.length, key_prefix_ok: key.startsWith('sk-ant-') }, 502);
    const j = await r.json();
    const text = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    let out = { action: 'PASS', confidence: 0, reason: 'could not parse model reply' };
    if (s >= 0 && e > s) {
      const p = JSON.parse(text.slice(s, e + 1));
      const a = String(p.action || '').toUpperCase();
      out = { action: ['LONG', 'SHORT', 'PASS'].indexOf(a) >= 0 ? a : 'PASS', confidence: Math.max(0, Math.min(1, Number(p.confidence) || 0)), reason: String(p.reason || '').slice(0, 160) };
    }
    return json(out);
  } catch (err) {
    return json({ error: 'failed' }, 502);
  }
};
