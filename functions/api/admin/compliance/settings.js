import { json, err, newId, requireAdmin } from "../../../_lib/db.js";
const ALLOWED = new Set(["controller_name","controller_address","company_registration","privacy_email","support_email","dpo_email","dsa_contact_email","country"]);
export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, error } = await requireAdmin(context); if (error) return error;
  const body = await request.json().catch(()=>null); if(!body?.settings) return err("settings are required");
  let changed=0;
  for (const [key,value] of Object.entries(body.settings)) {
    if(!ALLOWED.has(key)) continue;
    await env.DB.prepare(`INSERT INTO legal_settings(setting_key,setting_value,updated_by,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`).bind(key,String(value||'').trim().slice(0,1000),user.id).run(); changed++;
  }
  await env.DB.prepare(`INSERT INTO admin_audit_log(id,admin_user_id,action,target_type,target_id,details) VALUES(?,?, 'legal_settings_updated','compliance','legal-settings',?)`).bind(newId(),user.id,JSON.stringify({changed})).run();
  return json({ok:true,changed});
}
