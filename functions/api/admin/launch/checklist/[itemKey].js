import { json, err, newId, requireAdmin } from "../../../../_lib/db.js";
import { LAUNCH_CHECKLIST } from "../../../../_lib/readiness.js";
export async function onRequestPost(context){
  const {request,env,params}=context;
  const {user,error}=await requireAdmin(context); if(error) return error;
  const item=LAUNCH_CHECKLIST.find(x=>x.key===params.itemKey); if(!item) return err("Unknown launch checklist item",404);
  const body=await request.json().catch(()=>null); if(!body||typeof body.completed!=="boolean") return err("completed must be true or false");
  await env.DB.prepare(`INSERT INTO pilot_launch_checklist (item_key,label,completed,completed_by,completed_at,updated_at) VALUES (?,?,?,?,CASE WHEN ?=1 THEN CURRENT_TIMESTAMP ELSE NULL END,CURRENT_TIMESTAMP) ON CONFLICT(item_key) DO UPDATE SET label=excluded.label,completed=excluded.completed,completed_by=CASE WHEN excluded.completed=1 THEN excluded.completed_by ELSE NULL END,completed_at=CASE WHEN excluded.completed=1 THEN CURRENT_TIMESTAMP ELSE NULL END,updated_at=CURRENT_TIMESTAMP`).bind(item.key,item.label,body.completed?1:0,user.id,body.completed?1:0).run();
  await env.DB.prepare(`INSERT INTO admin_audit_log (id,admin_user_id,action,target_type,target_id,details) VALUES (?,?,?,'launch_checklist',?,?)`).bind(newId(),user.id,body.completed?"launch_check_completed":"launch_check_reopened",item.key,JSON.stringify({label:item.label})).run();
  return json({ok:true});
}
