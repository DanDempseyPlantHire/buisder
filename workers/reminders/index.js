import { createNotification } from '../../functions/_lib/db.js';
import { maybeSendDueInterviewReminderEmails } from '../../functions/_lib/email-notifications.js';

async function runReminderSweep(env){
  const request=new Request(env.APP_URL||'https://deasjobs.com/');
  const email=await maybeSendDueInterviewReminderEmails(env,request);
  const {results}=await env.DB.prepare(
    `SELECT a.id AS applicationId,a.jobseeker_id AS userId,j.id AS jobId,j.title,j.company,
            ii.interview_at AS interviewAt,ii.location
     FROM applications a
     JOIN jobs j ON j.id=a.job_id
     JOIN interview_invites ii ON ii.application_id=a.id
     WHERE a.status='interview_accepted' AND ii.status='accepted'
       AND datetime(ii.interview_at)>datetime('now')
       AND datetime(ii.interview_at)<=datetime('now','+24 hours')
     ORDER BY datetime(ii.interview_at) ASC LIMIT 200`
  ).all();
  for(const row of results||[]){
    const hour=await env.DB.prepare("SELECT CASE WHEN datetime(?)<=datetime('now','+1 hour') THEN 1 ELSE 0 END AS yes").bind(row.interviewAt).first();
    const withinHour=Boolean(hour?.yes);
    await createNotification(env,{
      userId:row.userId,
      type:'interview_reminder',
      title:withinHour?'Interview in the next hour':'Interview reminder',
      body:withinHour?`Your interview for ${row.title} is coming up soon.`:`Your interview for ${row.title} with ${row.company||'the employer'} is within 24 hours.`,
      applicationId:row.applicationId,
      jobId:row.jobId,
      eventKey:`scheduled-interview-reminder-${withinHour?'1':'24'}:${row.applicationId}:${row.interviewAt}`
    });
  }
  return {email,checked:(results||[]).length};
}

export default {
  async scheduled(controller,env,ctx){
    ctx.waitUntil(runReminderSweep(env));
  }
};
