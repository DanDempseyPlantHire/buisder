import { newId } from './db.js';

async function flag(env,{eventKey,userId=null,jobId=null,applicationId=null,type,severity='medium',reason,evidence={}}){
  await env.DB.prepare(
    `INSERT OR IGNORE INTO risk_flags
     (id,event_key,subject_user_id,subject_job_id,subject_application_id,risk_type,severity,reason,evidence_json)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(newId(),eventKey,userId,jobId,applicationId,type,severity,reason,JSON.stringify(evidence||{})).run();
}

export async function assessApplicationRisk(env,userId,applicationId){
  try{
    const rapid=await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM applications WHERE jobseeker_id=? AND datetime(created_at)>=datetime('now','-1 hour')`
    ).bind(userId).first();
    if(Number(rapid?.n||0)>=12) await flag(env,{eventKey:`rapid_apply:${userId}:${new Date().toISOString().slice(0,13)}`,userId,applicationId,type:'rapid_application_activity',severity:'medium',reason:'Unusually high application volume in one hour.',evidence:{applicationsLastHour:Number(rapid.n)}});
  }catch{}
}

export async function assessJobRisk(env,employerId,jobId){
  try{
    const reports=await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM safety_reports WHERE target_user_id=? AND status IN ('open','reviewing')`
    ).bind(employerId).first();
    if(Number(reports?.n||0)>=2) await flag(env,{eventKey:`employer_reports:${employerId}`,userId:employerId,jobId,type:'repeated_safety_reports',severity:'high',reason:'Employer has multiple unresolved safety reports.',evidence:{openReports:Number(reports.n)}});
    const volume=await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM jobs WHERE employer_id=? AND datetime(created_at)>=datetime('now','-1 day')`
    ).bind(employerId).first();
    if(Number(volume?.n||0)>=15) await flag(env,{eventKey:`job_burst:${employerId}:${new Date().toISOString().slice(0,10)}`,userId:employerId,jobId,type:'job_posting_burst',severity:'medium',reason:'High job-posting volume in 24 hours.',evidence:{jobsLast24Hours:Number(volume.n)}});
  }catch{}
}

export async function runRiskSweep(env){
  try{
    const {results:reported}=await env.DB.prepare(
      `SELECT target_user_id AS userId,COUNT(*) AS n FROM safety_reports
       WHERE target_user_id IS NOT NULL AND status IN ('open','reviewing') GROUP BY target_user_id HAVING COUNT(*)>=2`
    ).all();
    for(const r of reported||[]) await flag(env,{eventKey:`employer_reports:${r.userId}`,userId:r.userId,type:'repeated_safety_reports',severity:'high',reason:'User has multiple unresolved safety reports.',evidence:{openReports:Number(r.n)}});
    const {results:msgs}=await env.DB.prepare(
      `SELECT am.sender_user_id AS userId,COUNT(*) AS n FROM message_reports mr JOIN application_messages am ON am.id=mr.message_id
       WHERE mr.status IN ('open','reviewing') GROUP BY am.sender_user_id HAVING COUNT(*)>=2`
    ).all();
    for(const r of msgs||[]) await flag(env,{eventKey:`message_reports:${r.userId}`,userId:r.userId,type:'repeated_message_reports',severity:'high',reason:'User has multiple unresolved message reports.',evidence:{openMessageReports:Number(r.n)}});
  }catch{}
}
