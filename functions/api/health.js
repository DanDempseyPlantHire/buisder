import { json } from "../_lib/db.js";
export async function onRequestGet({ env }) {
  try {
    await env.DB.prepare("SELECT 1 AS ok").first();
    return json({ ok:true, service:"DEASJobs", database:"ok", checkedAt:new Date().toISOString() }, { headers:{ "Cache-Control":"no-store" } });
  } catch {
    return json({ ok:false, service:"DEASJobs", database:"unavailable", checkedAt:new Date().toISOString() }, { status:503, headers:{ "Cache-Control":"no-store" } });
  }
}
