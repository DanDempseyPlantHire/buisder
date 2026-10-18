import { json, err, newId, requireAdmin } from '../../../_lib/db.js';
export async function onRequestPatch(context){
  const {user,error}=await requireAdmin(context); if(error)return error;
  const b=await context.request.json().catch(()=>null); if(!b)return err('Invalid request body');
  const status=String(b.status||''); if(!['reviewing','dismissed','actioned','open'].includes(status))return err('Invalid status');
  await context.env.DB.prepare(
    `UPDATE risk_flags SET status=?,admin_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(status,String(b.note||'').slice(0,1000)||null,user.id,context.params.id).run();
  await context.env.DB.prepare(
    `INSERT INTO admin_audit_log(id,admin_user_id,action,target_type,target_id,details) VALUES (?,?,?,?,?,?)`
  ).bind(newId(),user.id,'risk_flag_updated','risk_flag',context.params.id,`Status: ${status}`).run();
  return json({ok:true});
}
