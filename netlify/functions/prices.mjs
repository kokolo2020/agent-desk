// Live last prices for the dashboard (read-only, public OKX data). GET returns { COIN: lastPrice }.
export default async () => {
  try {
    const r = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SWAP');
    const j = await r.json(), out = {};
    for (const t of j.data || []) if (/-USDT-SWAP$/.test(t.instId)) out[t.instId.split('-')[0]] = +t.last;
    return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=5' } });
  } catch (e) { return new Response('{}', { status: 502, headers: { 'Content-Type': 'application/json' } }); }
};
