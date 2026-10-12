// Exit judge: asks Claude whether an open paper "fade" trade should be closed now (the "instinct" layer).
// Needs the env var ANTHROPIC_API_KEY (set in Netlify, never in the repo).
const SYSTEM = 'You are the EXIT JUDGE for a PAPER trading bot (no real money) that fades short swings inside a range: it buys dips and shorts bounces, aiming for about 0.5% in a few minutes. Round-trip fees are 0.11% of position, so a close under +0.15% is roughly break-even. A hard take profit (+0.5%), stop (-0.8%) and 6-minute time exit already exist; you decide whether to close EARLIER. Close when the move has stalled or is rolling over after a gain, when price keeps pushing against the position with no sign of a turn, or when the range looks broken. Hold when momentum still favors the position or it needs a little more time. Use only the data given. Reply with ONLY compact JSON: {"action":"HOLD"|"CLOSE","reason":"max 140 chars"}';
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
  if (hits.length >= 20) return json({ error: 'rate limit' }, 429);
  hits.push(now);
  let body;
  try { body = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  if (!body || !body.coin || !body.position) return json({ error: 'missing fields' }, 400);
  const prompt = 'Coin: ' + String(body.coin).slice(0, 10) + '\nOpen position and market (JSON): ' + JSON.stringify(body.position).slice(0, 3000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 1500, system: SYSTEM, messages: [{ role: 'user', content: prompt }] })
    });
    if (!r.ok) return json({ error: 'anthropic ' + r.status }, 502);
    const j = await r.json();
    const text = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    let out = { action: 'HOLD', reason: 'could not parse model reply' };
    if (s >= 0 && e > s) {
      const p = JSON.parse(text.slice(s, e + 1));
      out = { action: String(p.action || '').toUpperCase() === 'CLOSE' ? 'CLOSE' : 'HOLD', reason: String(p.reason || '').slice(0, 160) };
    }
    return json(out);
  } catch (err) {
    return json({ error: 'failed' }, 502);
  }
};
