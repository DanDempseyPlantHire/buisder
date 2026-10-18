import { json, err, newId, requireUser } from '../../_lib/db.js';
export async function onRequestPost(context){
  const {user,error}=await requireUser(context); if(error)return error;
  const b=await context.request.json().catch(()=>null); if(!b?.messageId)return err('messageId is required');
  const msg=await context.env.DB.prepare(
    `SELECT m.id,m.sender_user_id AS senderUserId,m.application_id AS applicationId,a.jobseeker_id AS jobseekerId,j.employer_id AS employerId
     FROM application_messages m JOIN applications a ON a.id=m.application_id JOIN jobs j ON j.id=a.job_id WHERE m.id=?`
  ).bind(b.messageId).first();
  if(!msg||![msg.jobseekerId,msg.employerId].includes(user.id)||msg.senderUserId===user.id)return err('Message not found',404);
  const id=newId();
  await context.env.DB.prepare(
    `INSERT INTO message_reports(id,message_id,reporter_user_id,reason,details) VALUES (?,?,?,?,?)`
  ).bind(id,msg.id,user.id,String(b.reason||'inappropriate').slice(0,100),String(b.details||'').slice(0,1000)||null).run();
  await context.env.DB.prepare(
    `INSERT OR IGNORE INTO risk_flags(id,event_key,subject_user_id,subject_application_id,risk_type,severity,reason,evidence_json)
     VALUES (?,?,?,?, 'reported_message','high','An application message was reported.',?)`
  ).bind(newId(),`message-report:${id}`,msg.senderUserId,msg.applicationId,JSON.stringify({messageId:msg.id,reportId:id})).run();
  return json({ok:true});
}
