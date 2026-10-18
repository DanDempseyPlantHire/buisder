import { json, err, newId, requireAdmin } from '../../../../_lib/db.js';

export async function onRequestPatch(context){
  const {user,error}=await requireAdmin(context); if(error) return error;
  const body=await context.request.json().catch(()=>null); if(!body) return err('Invalid request body');
  const status=String(body.status||'');
  if(!['open','reviewing','resolved','dismissed'].includes(status)) return err('Invalid status');
  const note=String(body.note||'').slice(0,1000)||null;
  const result=await context.env.DB.prepare(
    `UPDATE message_reports SET status=?,admin_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(status,note,user.id,context.params.id).run();
  if(!result.meta?.changes) return err('Message report not found',404);
  await context.env.DB.prepare(
    `INSERT INTO admin_audit_log(id,admin_user_id,action,target_type,target_id,details) VALUES (?,?,?,?,?,?)`
  ).bind(newId(),user.id,'message_report_updated','message_report',context.params.id,`Status: ${status}`).run();
  return json({ok:true});
}
