import { json, err, newId, requireUser, createNotification } from '../../_lib/db.js';

async function access(env,user,applicationId){
  const row=await env.DB.prepare(
    `SELECT a.id,a.status,a.jobseeker_id AS jobseekerId,j.employer_id AS employerId,j.title
     FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.id=?`
  ).bind(applicationId).first();
  if(!row) return null;
  if(user.id!==row.jobseekerId&&user.id!==row.employerId&&!user.isAdmin) return null;
  return row;
}

export async function onRequestGet(context){
  const {user,error}=await requireUser(context); if(error)return error;
  const applicationId=context.params.applicationId;
  const a=await access(context.env,user,applicationId); if(!a)return err('Application not found',404);
  if(!user.isAdmin){
    await context.env.DB.prepare(
      `UPDATE application_messages SET read_at=CURRENT_TIMESTAMP
       WHERE application_id=? AND sender_user_id<>? AND read_at IS NULL`
    ).bind(applicationId,user.id).run();
  }
  const {results}=await context.env.DB.prepare(
    `SELECT m.id,m.sender_user_id AS senderUserId,m.body,m.read_at AS readAt,m.created_at AS createdAt,
            u.name AS senderName,u.role AS senderRole
     FROM application_messages m JOIN users u ON u.id=m.sender_user_id
     WHERE m.application_id=? ORDER BY m.created_at ASC LIMIT 200`
  ).bind(applicationId).all();
  return json({application:{id:a.id,status:a.status,title:a.title},messages:results||[]});
}

export async function onRequestPost(context){
  const {user,error}=await requireUser(context); if(error)return error;
  const applicationId=context.params.applicationId;
  const a=await access(context.env,user,applicationId); if(!a)return err('Application not found',404);
  if(user.isAdmin) return err('Admin cannot message as a participant',403);
  if(['unsuccessful','withdrawn'].includes(a.status)) return err('Messaging is closed for this application',409);
  const b=await context.request.json().catch(()=>null), body=String(b?.body||'').trim();
  if(!body)return err('Message cannot be empty'); if(body.length>1200)return err('Message must be 1,200 characters or fewer');
  const other=user.id===a.jobseekerId?a.employerId:a.jobseekerId;
  const blocked=await context.env.DB.prepare(
    `SELECT 1 AS yes FROM user_blocks WHERE (blocker_user_id=? AND blocked_user_id=?) OR (blocker_user_id=? AND blocked_user_id=?) LIMIT 1`
  ).bind(user.id,other,other,user.id).first();
  if(blocked)return err('Messaging is unavailable between these accounts',403);
  const id=newId();
  await context.env.DB.prepare('INSERT INTO application_messages(id,application_id,sender_user_id,body) VALUES (?,?,?,?)').bind(id,applicationId,user.id,body).run();
  await createNotification(context.env,{userId:other,type:'message',title:'New application message',body:`New message about ${a.title}.`,applicationId,eventKey:`message:${id}`});
  return json({id},{status:201});
}
