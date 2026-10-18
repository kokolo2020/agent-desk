import { tickAll } from '../lib/ap.mjs';
export default async () => { const r = await tickAll(process.env); console.log(JSON.stringify(r)); return new Response(JSON.stringify(r)); };
// Scheduled run disabled 18 Oct 2026: autopilot-ai.netlify.app is the live runner. Two runners on one database opened duplicate Neutral Rev batches.
