import { json, err, newId } from '../../_lib/db.js';
import { sha256Hex } from '../../_lib/security.js';
import { assessJobRisk } from '../../_lib/risk.js';

async function authenticate(env,request){
  const token=String(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
  if(!token)return null; const hash=await sha256Hex(token);
  const row=await env.DB.prepare(
    `SELECT k.id,k.employer_id AS employerId,u.is_suspended AS isSuspended,ep.verification_status AS verificationStatus
     FROM integration_api_keys k JOIN users u ON u.id=k.employer_id LEFT JOIN employer_profiles ep ON ep.user_id=k.employer_id
     WHERE k.token_hash=? AND k.status='active'`
  ).bind(hash).first();
  if(row&&!row.isSuspended) await env.DB.prepare('UPDATE integration_api_keys SET last_used_at=CURRENT_TIMESTAMP WHERE id=?').bind(row.id).run();
  return row&&!row.isSuspended?row:null;
}
function val(v,n=1000){return String(v??'').trim().slice(0,n);}
export async function onRequestPost({request,env}){
  const auth=await authenticate(env,request); if(!auth)return err('Invalid integration token',401);
  if(auth.verificationStatus!=='verified')return err('Employer must be verified before using job imports',403);
  const body=await request.json().catch(()=>null), items=Array.isArray(body?.jobs)?body.jobs:[];
  if(!items.length)return err('jobs array is required'); if(items.length>50)return err('Maximum 50 jobs per request');
  const profile=await env.DB.prepare('SELECT company_name FROM employer_profiles WHERE user_id=?').bind(auth.employerId).first();
  const results=[];
  for(const input of items){
    const externalId=val(input.externalId,120), title=val(input.title,160);
    if(!externalId||!title){results.push({externalId,error:'externalId and title are required'});continue;}
    const linked=await env.DB.prepare('SELECT job_id AS jobId FROM integration_job_links WHERE employer_id=? AND external_job_id=?').bind(auth.employerId,externalId).first();
    const status=['active','paused','closed'].includes(input.status)?input.status:'active';
    try{
      if(linked?.jobId){
        await env.DB.prepare(
          `UPDATE jobs SET title=?,location=?,pay=?,hours=?,experience=?,start_date=?,description=?,tags=?,employment_type=?,min_age=?,pay_min=?,schedule_tags=?,latitude=?,longitude=?,status=? WHERE id=? AND employer_id=?`
        ).bind(title,val(input.location,160),val(input.pay,100),val(input.hours,120),val(input.experience,60)||'None',val(input.startDate,80),val(input.description,5000),JSON.stringify(input.tags||[]),val(input.employmentType,80)||'Part-time',Number(input.minAge||16),input.payMin===undefined||input.payMin===null?null:Number(input.payMin),JSON.stringify(input.scheduleTags||[]),input.latitude??null,input.longitude??null,status,linked.jobId,auth.employerId).run();
        results.push({externalId,jobId:linked.jobId,action:'updated'});
      }else{
        const id=newId();
        await env.DB.prepare(
          `INSERT INTO jobs(id,employer_id,title,company,location,pay,hours,experience,start_date,description,tags,employment_type,min_age,pay_min,schedule_tags,latitude,longitude,status)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(id,auth.employerId,title,profile?.company_name||'Employer',val(input.location,160),val(input.pay,100),val(input.hours,120),val(input.experience,60)||'None',val(input.startDate,80),val(input.description,5000),JSON.stringify(input.tags||[]),val(input.employmentType,80)||'Part-time',Number(input.minAge||16),input.payMin===undefined||input.payMin===null?null:Number(input.payMin),JSON.stringify(input.scheduleTags||[]),input.latitude??null,input.longitude??null,status).run();
        await env.DB.prepare('INSERT INTO integration_job_links(id,employer_id,external_job_id,job_id) VALUES (?,?,?,?)').bind(newId(),auth.employerId,externalId,id).run();
        await assessJobRisk(env,auth.employerId,id);
        results.push({externalId,jobId:id,action:'created'});
      }
    }catch(e){results.push({externalId,error:String(e?.message||e).slice(0,300)});}
  }
  await env.DB.prepare('INSERT INTO integration_events(id,employer_id,integration_type,event_type,status,details) VALUES (?,?,?,?,?,?)').bind(newId(),auth.employerId,'jobs_api','bulk_import','completed',JSON.stringify({count:items.length,success:results.filter(x=>!x.error).length})).run();
  return json({results});
}
