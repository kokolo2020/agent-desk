// Manual trigger for testing: /.netlify/functions/ap-tick?job=tick|news-btc|news-near (desk site only).
import { tickAll, newsJob } from '../lib/ap.mjs';
const json = (o, s = 200) => new Response(JSON.stringify(o, null, 1), { status: s, headers: { 'Content-Type': 'application/json' } });
export default async (req) => {
  const origin = req.headers.get('origin') || req.headers.get('referer') || '';
  if (!/desk-agent\.netlify\.app|localhost/.test(origin)) return json({ error: 'origin' }, 403);
  const job = new URL(req.url).searchParams.get('job') || 'tick';
  try {
    if (job === 'tick') return json(await tickAll(process.env));
    if (job === 'news-btc') return json(await newsJob(process.env, 'BTC'));
    if (job === 'news-near') return json(await newsJob(process.env, 'NEAR'));
    return json({ error: 'unknown job' }, 400);
  } catch (e) { return json({ error: String(e.message || e).slice(0, 300) }, 500); }
};
