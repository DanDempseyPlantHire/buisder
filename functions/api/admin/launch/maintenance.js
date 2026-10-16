import { json, err, newId, requireAdmin } from "../../../_lib/db.js";
const ACTIONS=new Set(["cleanup_auth","repair_defaults","close_suspended_jobs","remove_demo_data"]);
const changes=r=>Number(r?.meta?.changes||0);
export async function onRequestPost(context){
  const {request,env}=context; const {user,error}=await requireAdmin(context); if(error) return error;
  const body=await request.json().catch(()=>null); const action=String(body?.action||""); if(!ACTIONS.has(action)) return err("Unsupported maintenance action");
  let affected=0,details={};
  if(action==="cleanup_auth"){
    const a=await env.DB.prepare("DELETE FROM sessions WHERE datetime(expires_at)<=datetime('now')").run();
    const b=await env.DB.prepare(`DELETE FROM auth_tokens WHERE datetime(expires_at)<=datetime('now','-7 days') OR (used_at IS NOT NULL AND datetime(used_at)<=datetime('now','-7 days'))`).run();
    const c=await env.DB.prepare(`DELETE FROM auth_rate_limits WHERE datetime(updated_at)<=datetime('now','-7 days') AND (blocked_until IS NULL OR datetime(blocked_until)<=datetime('now'))`).run();
    details={sessions:changes(a),authTokens:changes(b),rateLimits:changes(c)}; affected=details.sessions+details.authTokens+details.rateLimits;
  }
  if(action==="repair_defaults"){
    const a=await env.DB.prepare(`INSERT OR IGNORE INTO privacy_preferences (user_id) SELECT id FROM users`).run();
    const b=await env.DB.prepare(`INSERT OR IGNORE INTO employer_commercial_accounts (employer_id,plan_code,status,source) SELECT id,'free','active','v18_repair' FROM users WHERE role='employer'`).run();
    details={privacyPreferences:changes(a),employerCommercialAccounts:changes(b)}; affected=details.privacyPreferences+details.employerCommercialAccounts;
  }
  if(action==="close_suspended_jobs"){
    const a=await env.DB.prepare(`UPDATE jobs SET status='closed' WHERE status IN ('active','paused') AND employer_id IN (SELECT id FROM users WHERE is_suspended=1)`).run();
    affected=changes(a); details={jobsClosed:affected};
  }
  if(action==="remove_demo_data"){
    const demo=await env.DB.prepare("SELECT id FROM users WHERE id='seed-employer'").first();
    if(demo){ const a=await env.DB.prepare("DELETE FROM users WHERE id='seed-employer'").run(); affected=changes(a); }
    details={demoAccountsRemoved:affected};
  }
  await env.DB.prepare(`INSERT INTO admin_audit_log (id,admin_user_id,action,target_type,target_id,details) VALUES (?,?,?,'system','pilot-readiness',?)`).bind(newId(),user.id,`maintenance_${action}`,JSON.stringify({affected,...details})).run();
  return json({ok:true,action,affected,details});
}
