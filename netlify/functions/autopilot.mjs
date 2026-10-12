import { tickAll } from '../lib/ap.mjs';
export default async () => { const r = await tickAll(process.env); console.log(JSON.stringify(r)); return new Response(JSON.stringify(r)); };
export const config = { schedule: '*/5 * * * *' };
