// Autopilot core: paper trading decided by Claude, with news. Paper money only, no exchange keys.
export const SB_URL = 'https://seiqqvplosnwquaksshm.supabase.co';
export const START = 250, FEE = 0.00055, LEV = 5, COOLDOWN_MIN = 10, MODEL = 'claude-haiku-5-5';
// v1.13: top-20 universe (OKX USDT perpetuals). Contract sizes are read from OKX at run time; coins OKX does not list are dropped.
export const TOP_N = 50;
// market-cap order; extras at the end are spares, so 50 stay live if OKX lacks a few
export const TOP = ['BTC', 'ETH', 'XRP', 'BNB', 'SOL', 'DOGE', 'TRX', 'ADA', 'LINK', 'AVAX', 'SUI', 'XLM', 'BCH', 'HBAR', 'LTC', 'TON', 'DOT', 'UNI', 'AAVE', 'NEAR', 'SHIB', 'PEPE', 'ETC', 'APT', 'ARB', 'OP', 'ATOM', 'FIL', 'ICP', 'INJ', 'TAO', 'ONDO', 'POL', 'CRO', 'ALGO', 'VET', 'TIA', 'SEI', 'RENDER', 'WLD', 'FET', 'ENA', 'JUP', 'PENDLE', 'LDO', 'STX', 'IMX', 'GRT', 'CRV', 'MKR', 'XMR', 'ZEC', 'TRUMP', 'BONK', 'WIF', 'FLOKI'];
export const COINS = {};
for (const s of TOP) COINS[s] = { name: s, inst: s + '-USDT-SWAP', ct: 1 };
COINS.BTC.name = 'Bitcoin'; COINS.ETH.name = 'Ethereum'; COINS.NEAR.name = 'NEAR Protocol';
export const MAX_OPEN = 10, PICKS = 8, MAX_SPREAD_BPS = 12;
export const decFor = (p) => (p >= 1000 ? 2 : p >= 10 ? 3 : p >= 1 ? 4 : 6);
let instAt = 0;
async function loadInstruments() {
  if (Date.now() - instAt < 3600000) return;
  const list = await okx('/api/v5/public/instruments?instType=SWAP');
  const by = {}; for (const i of list) by[i.instId] = i;
  for (const s of Object.keys(COINS)) {
    const i = by[COINS[s].inst];
    if (!i || i.state !== 'live') { delete COINS[s]; continue; }
    COINS[s].ct = +i.ctVal * (+i.ctMult || 1) || 1;
  }
  const keep = TOP.filter((x) => COINS[x]).slice(0, TOP_N);
  for (const x of Object.keys(COINS)) if (!keep.includes(x)) delete COINS[x];
  instAt = Date.now();
}

/* ---------- Supabase (service key, server only) ---------- */
function sbHeaders(key, extra) {
  const h = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) h.Authorization = 'Bearer ' + key;
  return Object.assign(h, extra || {});
}
export function sb(key) {
  return {
    async select(table, query) {
      const r = await fetch(SB_URL + '/rest/v1/' + table + '?' + query, { headers: sbHeaders(key) });
      if (!r.ok) throw new Error('select ' + table + ' ' + r.status + ' ' + (await r.text()).slice(0, 120));
      return r.json();
    },
    async insert(table, row) {
      const r = await fetch(SB_URL + '/rest/v1/' + table, { method: 'POST', headers: sbHeaders(key, { Prefer: 'return=representation' }), body: JSON.stringify(row) });
      if (!r.ok) throw new Error('insert ' + table + ' ' + r.status + ' ' + (await r.text()).slice(0, 120));
      return (await r.json())[0];
    },
    async insertMany(table, rows) {
      if (!rows.length) return;
      const r = await fetch(SB_URL + '/rest/v1/' + table, { method: 'POST', headers: sbHeaders(key, { Prefer: 'return=minimal' }), body: JSON.stringify(rows) });
      if (!r.ok) throw new Error('insertMany ' + table + ' ' + r.status + ' ' + (await r.text()).slice(0, 120));
    },
    async update(table, query, patch) {
      const r = await fetch(SB_URL + '/rest/v1/' + table + '?' + query, { method: 'PATCH', headers: sbHeaders(key, { Prefer: 'return=minimal' }), body: JSON.stringify(patch) });
      if (!r.ok) throw new Error('update ' + table + ' ' + r.status + ' ' + (await r.text()).slice(0, 120));
    }
  };
}

/* ---------- Market data (OKX public API) ---------- */
async function okx(path) {
  const r = await fetch('https://www.okx.com' + path, { headers: { 'User-Agent': 'agent-desk-autopilot' } });
  if (!r.ok) throw new Error('okx ' + r.status);
  const j = await r.json();
  if (j.code !== '0') throw new Error('okx ' + j.code + ' ' + j.msg);
  return j.data;
}
export async function getMarket(coin) {
  const c = COINS[coin];
  const [cd, tk, fr, bk] = await Promise.all([
    okx('/api/v5/market/candles?instId=' + c.inst + '&bar=1m&limit=100'),
    okx('/api/v5/market/ticker?instId=' + c.inst),
    okx('/api/v5/public/funding-rate?instId=' + c.inst),
    okx('/api/v5/market/books?instId=' + c.inst + '&sz=20')
  ]);
  const candles = cd.map((k) => ({ t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4] })).sort((a, b) => a.t - b.t);
  const t = tk[0], price = +t.last;
  const asks = bk[0].asks, bids = bk[0].bids;
  const spread = ((+asks[0][0] - +bids[0][0]) / price) * 1e4;
  const depth = asks.concat(bids).reduce((s, x) => s + +x[0] * +x[1] * c.ct, 0);
  const n = candles.length, ref = candles[Math.max(0, n - 7)].c;
  return {
    coin, price, candles,
    mom6m_pct: ((price - ref) / ref) * 100,
    change24h_pct: ((price - +t.open24h) / +t.open24h) * 100,
    funding_pct: +fr[0].fundingRate * 100,
    spread_bps: spread, book_depth_usd: depth
  };
}

/* ---------- Swing features (rallies and pullbacks) ---------- */
export function features(m) {
  const k = m.candles, n = k.length, p = m.price;
  const back = (mins) => k[Math.max(0, n - 1 - mins)].c;
  const ret = (mins) => ((p - back(mins)) / back(mins)) * 100;
  const w = k.slice(-60), hi = Math.max.apply(null, w.map((x) => x.h)), lo = Math.min.apply(null, w.map((x) => x.l));
  const rets = []; for (let i = n - 30; i < n; i++) if (i > 0) rets.push((k[i].c - k[i - 1].c) / k[i - 1].c * 100);
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  return {
    ret_5m: ret(5), ret_15m: ret(15), ret_30m: ret(30), ret_60m: ret(60),
    pullback_pct: ((hi - p) / hi) * 100,   // how far below the 60m high we are
    bounce_pct: ((p - lo) / lo) * 100,     // how far above the 60m low we are
    range_60m: ((hi - lo) / lo) * 100,
    vol_1m: Math.sqrt(rets.reduce((a, b) => a + (b - mean) * (b - mean), 0) / rets.length)
  };
}
const r4 = (x) => +Number(x).toFixed(4);

/* ---------- Claude ---------- */
async function claude(key, body) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(Object.assign({ model: MODEL }, body))
  });
  if (!r.ok) throw new Error('anthropic ' + r.status + ' ' + (await r.text()).slice(0, 160));
  const j = await r.json();
  return (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}
function lastJson(text) {
  const e = text.lastIndexOf('}');
  if (e < 0) return null;
  for (let s = text.lastIndexOf('{', e); s >= 0; s = text.lastIndexOf('{', s - 1)) {
    try { return JSON.parse(text.slice(s, e + 1)); } catch (x) {}
  }
  return null;
}

/* ---------- News scan (runs every ~2h per coin) ---------- */
export async function newsJob(env, coin) {
  if (!env.SUPABASE_SERVICE_KEY || !env.ANTHROPIC_API_KEY) return { skipped: 'missing keys' };
  const db = sb(env.SUPABASE_SERVICE_KEY);
  await db.select('ap_news', 'select=id&limit=1'); // fails fast if tables are missing, before spending on Claude
  const c = COINS[coin];
  const text = await claude(env.ANTHROPIC_API_KEY, {
    max_tokens: 4000,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
    system: 'You are the news analyst of a paper-trading desk. Search the web for NEWS FROM THE LAST 48 HOURS that could move the price of the coin: protocol announcements, tokenomics or emissions changes, ETF or listing news, partnerships, hacks or outages, regulation, big macro events. Ignore generic price-prediction articles. Be skeptical: many headlines are already priced in. Dates matter: use the date given in the question. If you name a scheduled event (CPI, Fed, ETF launch), give its exact date and say whether it has ALREADY happened as of now; never call a past event upcoming. If sources disagree on a figure or date, say so and use the more conservative reading. Finish with ONLY a JSON object: {"sentiment":"bullish"|"bearish"|"neutral","strength":0..1,"catalyst":"short label or none","summary":"max 350 chars, say what happened and when","sources":["url","url"]}',
    messages: [{ role: 'user', content: 'Coin: ' + c.name + ' (' + coin + '). Today is ' + new Date().toISOString().slice(0, 10) + '. What recent news matters for its price in the next few hours? Today is ' + new Date().toUTCString() + '.' }]
  });
  const j = lastJson(text) || { sentiment: 'neutral', strength: 0, catalyst: 'none', summary: 'could not parse news reply', sources: [] };
  const row = {
    coin, sentiment: ['bullish', 'bearish', 'neutral'].includes(j.sentiment) ? j.sentiment : 'neutral',
    strength: Math.max(0, Math.min(1, Number(j.strength) || 0)),
    catalyst: String(j.catalyst || 'none').slice(0, 80), summary: String(j.summary || '').slice(0, 500),
    sources: Array.isArray(j.sources) ? j.sources.slice(0, 4) : []
  };
  await db.insert('ap_news', row);
  return row;
}

/* ---------- Decision loop (runs every 5 min) ---------- */
const closePos = async (db, p, exit, why) => {
  const dir = p.side === 'LONG' ? 1 : -1;
  const fees = p.notional * FEE * 2, pnl = p.notional * (dir * (exit - p.entry_price)) / p.entry_price - fees;
  await db.update('ap_positions', 'id=eq.' + p.id, { status: 'closed', exit_price: exit, closed_at: new Date().toISOString(), pnl, fees, close_reason: why });
  return pnl;
};

async function manageOpen(db, p, m) {
  const t0 = new Date(p.opened_at).getTime(), tp = +p.tp, sl = +p.sl;
  for (const k of m.candles.filter((x) => x.t >= t0 - 60000)) {
    const long = p.side === 'LONG';
    const hitSl = long ? k.l <= sl : k.h >= sl, hitTp = long ? k.h >= tp : k.l <= tp;
    if (hitSl) return { closed: true, pnl: await closePos(db, p, sl, 'stop hit') }; // stop first if both in one candle
    if (hitTp) return { closed: true, pnl: await closePos(db, p, tp, 'take profit hit') };
  }
  if (Date.now() >= new Date(p.max_hold_until).getTime()) return { closed: true, pnl: await closePos(db, p, m.price, 'time exit') };
  return { closed: false };
}

async function backfillOutcomes(db, coin, m) {
  const rows = await db.select('ap_decisions', 'select=id,ts,price&coin=eq.' + coin + '&outcome_price=is.null&ts=lt.' + new Date(Date.now() - 15 * 60000).toISOString() + '&ts=gt.' + new Date(Date.now() - 90 * 60000).toISOString());
  for (const d of rows) {
    const target = new Date(d.ts).getTime() + 15 * 60000;
    const k = m.candles.reduce((b, x) => (Math.abs(x.t - target) < Math.abs(b.t - target) ? x : b), m.candles[0]);
    await db.update('ap_decisions', 'id=eq.' + d.id, { outcome_price: k.c, outcome_at: new Date(k.t).toISOString() });
  }
}

async function backfillSamples(db, coin, m) {
  const at = (ts, mins) => { const target = new Date(ts).getTime() + mins * 60000; return m.candles.reduce((b, x) => (Math.abs(x.t - target) < Math.abs(b.t - target) ? x : b), m.candles[0]); };
  const a = await db.select('ap_samples', 'select=id,ts,price&coin=eq.' + coin + '&fwd_15m=is.null&ts=lt.' + new Date(Date.now() - 16 * 60000).toISOString() + '&ts=gt.' + new Date(Date.now() - 95 * 60000).toISOString());
  for (const x of a) await db.update('ap_samples', 'id=eq.' + x.id, { fwd_15m: r4(((at(x.ts, 15).c - +x.price) / +x.price) * 100) });
  const b = await db.select('ap_samples', 'select=id,ts,price&coin=eq.' + coin + '&fwd_60m=is.null&ts=lt.' + new Date(Date.now() - 61 * 60000).toISOString() + '&ts=gt.' + new Date(Date.now() - 98 * 60000).toISOString());
  for (const x of b) await db.update('ap_samples', 'id=eq.' + x.id, { fwd_60m: r4(((at(x.ts, 60).c - +x.price) / +x.price) * 100) });
}

const SYSTEM = 'You are CHIEF of an autonomous PAPER trading desk covering the top 50 coins (at most 10 open trades at once; 5x leverage, $250 bank per coin; a rule-based algo desk trades the same coins beside you and you are being compared with it). Round-trip taker fees are 0.11%, so a trade must have a realistic expected move of at least 0.35% to be worth it. You are in AGGRESSIVE mode: the owner wants more trades, so act on good-enough setups instead of waiting for perfect ones. Think in this order and let it show in your reason: (1) REGIME: use market_context (breadth of the top 20, BTC trend) to say whether this is a trend, a range or an event-driven chop; (2) EDGE: is this coin stronger or weaker than BTC (this_coin_vs_btc_60m_pct) and is that move continuing or exhausted; (3) CATALYST: only count news that is under 6 hours old, is not already priced in, and whose scheduled event has not already happened; (4) COST: expected move vs the 0.11% fee and the spread; (5) TRACK RECORD: desk_track_record and recent_decisions show what has worked, so do not repeat a losing pattern. Take a trade whenever one side has a clear edge (momentum continuing with BTC, or an exhausted spike worth fading); PASS only when there is truly no edge or the move already ran. Never chase a move that already ran more than 2.5x the coin\'s normal 15 minute range. Confidence means your honest probability that the trade reaches take profit before the stop: use 0.5 for a coin flip, 0.55+ when two of regime, edge and catalyst agree. You choose the exit plan: tp_pct (0.35 to 3), sl_pct (0.25 to 1.5), hold_min (15 to 360); tp_pct must be at least 1.2x sl_pct. Reply with ONLY JSON: {"action":"LONG"|"SHORT"|"PASS","confidence":0..1,"reason":"max 260 chars: regime, edge, catalyst, cost, in that order","tp_pct":number,"sl_pct":number,"hold_min":number}';

export async function tick(env, coin, shared) {
  shared = shared || { slots: { n: MAX_OPEN } };
  if (!env.SUPABASE_SERVICE_KEY || !env.ANTHROPIC_API_KEY) return { skipped: 'missing keys' };
  const db = sb(env.SUPABASE_SERVICE_KEY);
  const m = await getMarket(coin);
  const out = { coin, price: m.price };
  const closedAll = await db.select('ap_positions', 'select=pnl,closed_at,side,close_reason,decision_id&coin=eq.' + coin + '&status=eq.closed&order=closed_at.desc&limit=200');
  const bank = START + closedAll.reduce((s, x) => s + +x.pnl, 0);
  out.bank = +bank.toFixed(2);

  const F = features(m);
  const open = (await db.select('ap_positions', 'select=*&coin=eq.' + coin + '&status=eq.open&limit=1'))[0];
  if (open) {
    const r = await manageOpen(db, open, m);
    out.managed = r.closed ? 'closed ' + r.pnl.toFixed(2) : 'holding';
    if (!r.closed) return out;
    out.bank = +(bank + r.pnl).toFixed(2);
    return out; // cooldown starts now
  }
  if (closedAll[0] && Date.now() - new Date(closedAll[0].closed_at).getTime() < COOLDOWN_MIN * 60000) { out.skip = 'cooldown'; return out; }
  if (bank < 20) { out.skip = 'bank too low'; return out; }
  if (m.spread_bps > MAX_SPREAD_BPS) { out.skip = 'spread too wide ' + m.spread_bps.toFixed(1) + 'bps'; return out; }
  if (shared.slots.n <= 0) { out.skip = 'open-position cap'; return out; }

  const news = (await db.select('ap_news', 'select=*&coin=eq.' + coin + '&order=ts.desc&limit=1'))[0];
  const newsAgeH = news ? (Date.now() - new Date(news.ts).getTime()) / 3600000 : 99;
  const newsHot = news && newsAgeH < 3 && news.sentiment !== 'neutral' && +news.strength >= 0.4; // v1.12: only decides whether Claude is asked in a quiet market
  if (Math.abs(m.mom6m_pct) < 0.10 && !newsHot) { out.skip = 'quiet market, no hot news'; return out; }
  const lastDec = (await db.select('ap_decisions', 'select=ts&coin=eq.' + coin + '&order=ts.desc&limit=1'))[0];
  if (lastDec && Date.now() - new Date(lastDec.ts).getTime() < 4 * 60000) { out.skip = 'asked recently'; return out; }

  const hist = await db.select('ap_decisions', 'select=ts,action,confidence,reason,price,outcome_price,taken&coin=eq.' + coin + '&order=ts.desc&limit=8');
  const trades = await db.select('ap_positions', 'select=side,pnl,close_reason,opened_at&coin=eq.' + coin + '&status=eq.closed&order=closed_at.desc&limit=6');
  const ctx = {
    coin, now: new Date().toISOString(), bank: +bank.toFixed(2),
    market_context: shared.mkt ? Object.assign({}, shared.mkt, { this_coin_vs_btc_60m_pct: shared.btc60 == null ? null : r4(F.ret_60m - shared.btc60) }) : null,
    desk_track_record: shared.track || null,
    market: { price: m.price, mom6m_pct: +m.mom6m_pct.toFixed(3), change24h_pct: +m.change24h_pct.toFixed(2), funding_pct: +m.funding_pct.toFixed(4), spread_bps: +m.spread_bps.toFixed(2), book_depth_usd: Math.round(m.book_depth_usd), swings: { ret_15m_pct: r4(F.ret_15m), ret_30m_pct: r4(F.ret_30m), ret_60m_pct: r4(F.ret_60m), pullback_from_60m_high_pct: r4(F.pullback_pct), bounce_from_60m_low_pct: r4(F.bounce_pct), range_60m_pct: r4(F.range_60m), vol_1m_pct: r4(F.vol_1m) }, closes_1m_last30: m.candles.slice(-30).map((k) => k.c) },
    news: news && newsAgeH < 6 ? { age_hours: +newsAgeH.toFixed(1), sentiment: news.sentiment, strength: +news.strength, catalyst: news.catalyst, summary: news.summary } : (news ? 'last news scan is over 6 hours old, ignore it' : 'no news scan yet'),
    recent_decisions: hist.map((d) => ({ minutes_ago: Math.round((Date.now() - new Date(d.ts).getTime()) / 60000), action: d.action, confidence: +d.confidence, taken: d.taken, move_after_15m_pct: d.outcome_price ? +(((+d.outcome_price - +d.price) / +d.price) * 100).toFixed(3) : null, reason: String(d.reason || '').slice(0, 120) })),
    recent_closed_trades: trades.map((x) => ({ side: x.side, pnl: +(+x.pnl).toFixed(2), exit: x.close_reason }))
  };
  const text = await claude(env.ANTHROPIC_API_KEY, { max_tokens: 1500, system: SYSTEM, messages: [{ role: 'user', content: JSON.stringify(ctx) }] });
  const j = lastJson(text) || { action: 'PASS', confidence: 0, reason: 'could not parse model reply' };
  const action = ['LONG', 'SHORT', 'PASS'].includes(String(j.action).toUpperCase()) ? String(j.action).toUpperCase() : 'PASS';
  let tpP = Math.max(0.35, Math.min(3, Number(j.tp_pct) || 0.8)), slP = Math.max(0.25, Math.min(1.5, Number(j.sl_pct) || 0.4));
  if (tpP < slP * 1.2) tpP = +(slP * 1.2).toFixed(2);
  const hold = Math.max(15, Math.min(360, Number(j.hold_min) || 60));
  const conf = Math.max(0, Math.min(1, Number(j.confidence) || 0));
  const go = action !== 'PASS' && conf >= 0.5 && shared.slots.n > 0;
  if (go) shared.slots.n--;
  const dec = await db.insert('ap_decisions', { coin, action, confidence: conf, reason: String(j.reason || '').slice(0, 340), price: m.price, formula_mom: +m.mom6m_pct.toFixed(3), news_summary: news ? (news.catalyst + ': ' + news.summary).slice(0, 300) : null, tp_pct: tpP, sl_pct: slP, hold_min: hold, taken: go });
  out.decision = action + ' ' + conf.toFixed(2);
  if (go) {
    const dir = action === 'LONG' ? 1 : -1, notional = bank * LEV;
    await db.insert('ap_positions', { coin, side: action, entry_price: m.price, size: notional / m.price, notional, tp: +(m.price * (1 + dir * tpP / 100)).toFixed(decFor(m.price) + 2), sl: +(m.price * (1 - dir * slP / 100)).toFixed(decFor(m.price) + 2), max_hold_until: new Date(Date.now() + hold * 60000).toISOString(), decision_id: dec.id });
    out.opened = action;
  }
  return out;
}

/* ---------- Scanner over the top 20 (v1.13) ---------- */
async function scanCoin(coin, tk) {
  const c = COINS[coin];
  const cd = await okx('/api/v5/market/candles?instId=' + c.inst + '&bar=1m&limit=100');
  const candles = cd.map((k) => ({ t: +k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4] })).sort((a, b) => a.t - b.t);
  if (candles.length < 61) throw new Error('few candles');
  const price = +tk.last, n = candles.length, ref = candles[n - 7].c;
  const m = { coin, price, candles, mom6m_pct: ((price - ref) / ref) * 100, change24h_pct: ((price - +tk.open24h) / +tk.open24h) * 100 };
  const F = features(m);
  const z = Math.abs(m.mom6m_pct) / (F.vol_1m * Math.sqrt(6) + 0.01); // move size relative to this coin's own noise
  return { coin, m, F, z, spread_bps: tk.bidPx && tk.askPx ? ((+tk.askPx - +tk.bidPx) / price) * 1e4 : null };
}

export async function scanAll(env) {
  const db = sb(env.SUPABASE_SERVICE_KEY);
  await loadInstruments();
  const tks = {}; for (const t of await okx('/api/v5/market/tickers?instType=SWAP')) tks[t.instId] = t;
  const coins = Object.keys(COINS).filter((s) => tks[COINS[s].inst]), rows = [];
  for (let i = 0; i < coins.length; i += 10) {
    const part = await Promise.all(coins.slice(i, i + 10).map((s) => scanCoin(s, tks[COINS[s].inst]).catch(() => null)));
    for (const r of part) if (r) rows.push(r);
    if (i + 10 < coins.length) await new Promise((r) => setTimeout(r, 600));
  }
  const byCoin = {}; for (const r of rows) byCoin[r.coin] = r;
  // one snapshot row per coin, for pattern mining
  await db.insertMany('ap_samples', rows.map((r) => ({ coin: r.coin, price: r.m.price, ret_5m: r4(r.F.ret_5m), ret_15m: r4(r.F.ret_15m), ret_30m: r4(r.F.ret_30m), ret_60m: r4(r.F.ret_60m), pullback_pct: r4(r.F.pullback_pct), bounce_pct: r4(r.F.bounce_pct), range_60m: r4(r.F.range_60m), vol_1m: r4(r.F.vol_1m), change24h: r4(r.m.change24h_pct), spread_bps: r.spread_bps == null ? null : r4(r.spread_bps) }))).catch(() => {});
  const at = (cd, ts, mins) => { const target = new Date(ts).getTime() + mins * 60000; return cd.reduce((b, x) => (Math.abs(x.t - target) < Math.abs(b.t - target) ? x : b), cd[0]); };
  const iso = (ms) => new Date(Date.now() - ms).toISOString();
  const decs = await db.select('ap_decisions', 'select=id,ts,price,coin&outcome_price=is.null&ts=lt.' + iso(15 * 60000) + '&ts=gt.' + iso(90 * 60000)).catch(() => []);
  for (const d of decs) { const r = byCoin[d.coin]; if (!r) continue; const k = at(r.m.candles, d.ts, 15); await db.update('ap_decisions', 'id=eq.' + d.id, { outcome_price: k.c, outcome_at: new Date(k.t).toISOString() }).catch(() => {}); }
  const s15 = await db.select('ap_samples', 'select=id,ts,price,coin&fwd_15m=is.null&ts=lt.' + iso(16 * 60000) + '&ts=gt.' + iso(95 * 60000)).catch(() => []);
  await Promise.all(s15.map(async (x) => { const r = byCoin[x.coin]; if (r) await db.update('ap_samples', 'id=eq.' + x.id, { fwd_15m: r4(((at(r.m.candles, x.ts, 15).c - +x.price) / +x.price) * 100) }).catch(() => {}); }));
  const s60 = await db.select('ap_samples', 'select=id,ts,price,coin&fwd_60m=is.null&ts=lt.' + iso(61 * 60000) + '&ts=gt.' + iso(98 * 60000)).catch(() => []);
  await Promise.all(s60.map(async (x) => { const r = byCoin[x.coin]; if (r) await db.update('ap_samples', 'id=eq.' + x.id, { fwd_60m: r4(((at(r.m.candles, x.ts, 60).c - +x.price) / +x.price) * 100) }).catch(() => {}); }));
  return { rows, db };
}

/* ---------- Algo desk: plain rules, no AI, $250 per coin, stored as coin 'XXX:algo' ---------- */
export const ALGO = { rmin: 0.012, dev: 0.0035, tp: 0.6, sl: 0.6, holdMin: 30, cooldownMin: 10 };
export function algoSignal(m) {
  const k = m.candles, n = k.length, p = m.price;
  let hi = -1e18, lo = 1e18, sum = 0, i;
  for (i = n - 30; i < n; i++) { hi = Math.max(hi, k[i].h); lo = Math.min(lo, k[i].l); }
  for (i = n - 20; i < n; i++) sum += k[i].c;
  const mean = sum / 20, dev = (p - mean) / mean, range = (hi - lo) / p;
  const net30 = Math.abs(k[n - 5].c - k[n - 30].c) / p, net60 = Math.abs(k[n - 5].c - k[n - 60].c) / p, s60 = (k[n - 1].c - k[n - 60].c) / p;
  if (range < ALGO.rmin) return { why: 'range too quiet' };
  if (net30 > 0.4 * range || net60 >= 0.01) return { why: 'trending, not a range' };
  if (Math.abs(dev) < ALGO.dev) return { why: 'not stretched' };
  const side = dev < 0 ? 'LONG' : 'SHORT';
  if ((side === 'LONG' && s60 <= -0.005) || (side === 'SHORT' && s60 >= 0.005)) return { why: 'not fighting the 60m move' };
  let m3 = side === 'LONG' ? 1e18 : -1e18;
  for (i = n - 4; i <= n - 2; i++) m3 = side === 'LONG' ? Math.min(m3, k[i].c) : Math.max(m3, k[i].c);
  if (!(side === 'LONG' ? p >= m3 * 1.0003 : p <= m3 * 0.9997)) return { why: 'no turn yet' };
  return { side };
}
async function algoTick(db, r, openAlgo, closedAlgo) {
  const key = r.coin + ':algo', m = r.m;
  const open = openAlgo[key];
  if (open) { const x = await manageOpen(db, open, m); return x.closed ? 'closed ' + x.pnl.toFixed(2) : 'holding'; }
  const closed = closedAlgo[key] || [], bank = START + closed.reduce((s, x) => s + +x.pnl, 0);
  if (closed[0] && Date.now() - new Date(closed[0].closed_at).getTime() < ALGO.cooldownMin * 60000) return 'cooldown';
  if (bank < 20 || (r.spread_bps != null && r.spread_bps > MAX_SPREAD_BPS)) return 'skip';
  const sig = algoSignal(m);
  if (!sig.side) return sig.why;
  const dir = sig.side === 'LONG' ? 1 : -1, notional = bank * LEV, d = decFor(m.price) + 2;
  await db.insert('ap_positions', { coin: key, side: sig.side, entry_price: m.price, size: notional / m.price, notional, tp: +(m.price * (1 + dir * ALGO.tp / 100)).toFixed(d), sl: +(m.price * (1 - dir * ALGO.sl / 100)).toFixed(d), max_hold_until: new Date(Date.now() + ALGO.holdMin * 60000).toISOString() });
  return 'opened ' + sig.side;
}

export async function tickAll(env) {
  if (!env.SUPABASE_SERVICE_KEY || !env.ANTHROPIC_API_KEY) return [{ skipped: 'missing keys' }];
  const { rows, db } = await scanAll(env);
  const openAll = await db.select('ap_positions', 'select=*&status=eq.open');
  const open = openAll.filter((p) => !p.coin.includes(':')), openAlgo = {};
  for (const p of openAll) if (p.coin.endsWith(':algo')) openAlgo[p.coin] = p;
  const openSet = new Set(open.map((p) => p.coin)), closedAlgo = {};
  for (const x of await db.select('ap_positions', 'select=coin,pnl,closed_at&status=eq.closed&coin=like.*:algo&order=closed_at.desc&limit=3000').catch(() => [])) (closedAlgo[x.coin] = closedAlgo[x.coin] || []).push(x);
  const algoRes = await Promise.all(rows.map((r) => algoTick(db, r, openAlgo, closedAlgo).then((s) => r.coin + ' ' + s).catch((e) => r.coin + ' error ' + String(e.message || e).slice(0, 60))));
  const rets = rows.map((r) => r.F.ret_60m).sort((x, y) => x - y), btc = rows.find((r) => r.coin === 'BTC');
  const closed = await db.select('ap_positions', 'select=side,pnl&status=eq.closed&coin=not.like.*:*&order=closed_at.desc&limit=40').catch(() => []);
  const trk = (s) => { const a = closed.filter((x) => x.side === s); return { trades: a.length, wins: a.filter((x) => +x.pnl > 0).length, pnl: +a.reduce((p, x) => p + +x.pnl, 0).toFixed(2) }; };
  const shared = {
    slots: { n: MAX_OPEN - open.length }, btc60: btc ? btc.F.ret_60m : null,
    mkt: { coins_scanned: rows.length, up_60m: rows.filter((r) => r.F.ret_60m > 0).length, down_60m: rows.filter((r) => r.F.ret_60m < 0).length, median_ret_60m_pct: r4(rets[Math.floor(rets.length / 2)] || 0), btc_ret_60m_pct: btc ? r4(btc.F.ret_60m) : null, btc_change24h_pct: btc ? r4(btc.m.change24h_pct) : null },
    track: { last_40_closed: { LONG: trk('LONG'), SHORT: trk('SHORT') } }
  };
  // manage every open trade, then ask Claude about the PICKS coins whose move is biggest versus their own noise
  const picks = rows.filter((r) => !openSet.has(r.coin)).sort((a, b) => b.z - a.z).slice(0, PICKS).map((r) => r.coin);
  const todo = Array.from(openSet).concat(picks).filter((s) => COINS[s]);
  const res = await Promise.all(todo.map((coin) => tick(env, coin, shared).catch((e) => ({ coin, error: String(e.message || e).slice(0, 200) }))));
  return [{ scanned: rows.length, picks, open: Array.from(openSet), algo: algoRes.filter((x) => /opened|closed|error/.test(x)) }].concat(res);
}

/* Pick which coin the news job scans next: coins with an open trade or the biggest 24h move, oldest scan first. */
export async function pickNewsCoin(env) {
  const db = sb(env.SUPABASE_SERVICE_KEY);
  await loadInstruments();
  const [tk, news, open] = await Promise.all([okx('/api/v5/market/tickers?instType=SWAP'), db.select('ap_news', 'select=coin,ts&order=ts.desc&limit=300'), db.select('ap_positions', 'select=coin&status=eq.open&coin=not.like.*:*')]);
  const last = {}; for (const n of news) if (!last[n.coin]) last[n.coin] = new Date(n.ts).getTime();
  const move = {}; for (const t of tk) { const s = t.instId.replace('-USDT-SWAP', ''); if (COINS[s]) move[s] = Math.abs((+t.last - +t.open24h) / +t.open24h); }
  const openSet = new Set(open.map((p) => p.coin)), hot = Object.keys(move).sort((a, b) => move[b] - move[a]).slice(0, 5);
  const cand = Array.from(new Set(['BTC'].concat(Array.from(openSet), hot))).filter((s) => COINS[s] && Date.now() - (last[s] || 0) > 2 * 3600000);
  cand.sort((x, y) => (openSet.has(y) - openSet.has(x)) || ((last[x] || 0) - (last[y] || 0)));
  return cand[0] || null;
}
