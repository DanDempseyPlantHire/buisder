import { json, err, newId, requireAdmin } from "../../../../_lib/db.js";
const STATUSES=new Set(["active","paused","completed","withdrawn"]);
export async function onRequestPost(context){
  const {request,env,params}=context; const {user,error}=await requireAdmin(context); if(error)return error;
  const body=await request.json().catch(()=>null); if(!body)return err("Invalid request body");
  const target=await env.DB.prepare("SELECT id FROM users WHERE id=?").bind(params.userId).first(); if(!target)return err("User not found",404);
  const status=String(body.status||"active"); if(!STATUSES.has(status))return err("Invalid membership status");
  const current=await env.DB.prepare("SELECT id FROM pilot_memberships WHERE user_id=?").bind(params.userId).first();
  if(current){
    await env.DB.prepare(`UPDATE pilot_memberships SET cohort_id=?,organization_id=?,status=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?`)
      .bind(body.cohortId||null,body.organizationId||null,status,String(body.notes||"").trim().slice(0,2000),params.userId).run();
  }else{
    await env.DB.prepare(`INSERT INTO pilot_memberships (id,user_id,cohort_id,organization_id,source,status,notes) VALUES (?,?,?,?, 'admin', ?, ?)`)
      .bind(newId(),params.userId,body.cohortId||null,body.organizationId||null,status,String(body.notes||"").trim().slice(0,2000)).run();
  }
  await env.DB.prepare(`INSERT INTO admin_audit_log (id,admin_user_id,action,target_type,target_id,details) VALUES (?,?,'pilot_membership_updated','user',?,?)`)
    .bind(newId(),user.id,params.userId,JSON.stringify({cohortId:body.cohortId||null,organizationId:body.organizationId||null,status})).run();
  return json({ok:true});
}
