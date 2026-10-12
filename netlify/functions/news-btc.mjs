import { newsJob } from '../lib/ap.mjs';
export default async () => { try { const r = await newsJob(process.env, 'BTC'); console.log(JSON.stringify(r)); return new Response(JSON.stringify(r)); } catch (e) { console.log('news BTC error', String(e.message || e)); return new Response('error', { status: 500 }); } };
export const config = { schedule: '0 */2 * * *' };
