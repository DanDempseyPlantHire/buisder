import { json, err, newId, requireAdmin } from "../../../../_lib/db.js";
const STATUSES=new Set(["active","paused","completed","withdrawn"]);
export async function onRequestPost(context){
  const {request,env}=context; const {user,error}=await requireAdmin(context); if(error)return error;
  const body=await request.json().catch(()=>null); if(!body)return err("Invalid request body");
  const email=String(body.email||"").trim().toLowerCase(); if(!email)return err("Email is required");
  const target=await env.DB.prepare("SELECT id,email,role FROM users WHERE lower(email)=?").bind(email).first(); if(!target)return err("No Buisder account was found for that email",404);
  const status=String(body.status||"active"); if(!STATUSES.has(status))return err("Invalid membership status");
  const existing=await env.DB.prepare("SELECT id FROM pilot_memberships WHERE user_id=?").bind(target.id).first();
  if(existing){
    await env.DB.prepare(`UPDATE pilot_memberships SET cohort_id=?,organization_id=?,status=?,source='admin',updated_at=CURRENT_TIMESTAMP WHERE user_id=?`)
      .bind(body.cohortId||null,body.organizationId||null,status,target.id).run();
  }else{
    await env.DB.prepare(`INSERT INTO pilot_memberships (id,user_id,cohort_id,organization_id,source,status) VALUES (?,?,?,?, 'admin', ?)`)
      .bind(newId(),target.id,body.cohortId||null,body.organizationId||null,status).run();
  }
  await env.DB.prepare(`INSERT INTO admin_audit_log (id,admin_user_id,action,target_type,target_id,details) VALUES (?,?,'pilot_participant_added','user',?,?)`)
    .bind(newId(),user.id,target.id,JSON.stringify({email:target.email,role:target.role,cohortId:body.cohortId||null,organizationId:body.organizationId||null,status})).run();
  return json({ok:true,userId:target.id});
}
