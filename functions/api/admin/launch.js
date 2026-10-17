import { json, requireAdmin } from "../../_lib/db.js";
import { EXPECTED_TABLES, LAUNCH_CHECKLIST } from "../../_lib/readiness.js";

async function getTables(env){
  const {results}=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  return new Set((results||[]).map(r=>r.name));
}
async function count(env,sql,args=[]){
  const row=await env.DB.prepare(sql).bind(...args).first();
  return Number(row?.count||0);
}
function item(id,label,status,detail,action=null){ return {id,label,status,detail,action}; }

export async function onRequestGet(context){
  const {env}=context;
  const {error}=await requireAdmin(context);
  if(error) return error;
  const checks=[];
  let tables;
  try{
    await env.DB.prepare("SELECT 1 AS ok").first();
    tables=await getTables(env);
    checks.push(item("database","D1 database","pass","Database connection is working."));
  }catch{
    return json({automatedReady:false,checklistComplete:false,launchReady:false,checks:[item("database","D1 database","critical","Buisder cannot query the D1 database.")],checklist:[],summary:{critical:1,warning:0,pass:0,info:0},checkedAt:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});
  }

  const missing=EXPECTED_TABLES.filter(t=>!tables.has(t));
  checks.push(item("schema","Database schema",missing.length?"critical":"pass",missing.length?`Missing required tables: ${missing.join(", ")}`:"All expected Buisder tables are present."));

  const filesOk=Boolean(env.FILES);
  checks.push(item("r2","Private file storage",filesOk?"pass":"critical",filesOk?"R2 FILES binding is configured.":"R2 FILES binding is missing."));

  const turnstileOk=Boolean(String(env.TURNSTILE_SITE_KEY||"").trim())&&Boolean(String(env.TURNSTILE_SECRET_KEY||"").trim());
  checks.push(item("turnstile","Bot protection",turnstileOk?"pass":"critical",turnstileOk?"Turnstile site and secret keys are configured.":"Turnstile configuration is incomplete."));

  const emailOk=Boolean(String(env.RESEND_API_KEY||"").trim())&&Boolean(String(env.EMAIL_FROM||"").trim());
  checks.push(item("email","Transactional email",emailOk?"pass":"critical",emailOk?"Resend API key and sender are configured.":"Email delivery configuration is incomplete."));

  if(tables.has("email_delivery_log")){
    const failedEmails=await count(env,`SELECT COUNT(*) AS count FROM email_delivery_log WHERE status='failed' AND datetime(last_attempt_at)>=datetime('now','-24 hours')`);
    const sentEmails=await count(env,`SELECT COUNT(*) AS count FROM email_delivery_log WHERE status='sent' AND datetime(sent_at)>=datetime('now','-24 hours')`);
    checks.push(item(
      "recruitment_email_delivery",
      "Recruitment email delivery",
      failedEmails?"warning":"pass",
      failedEmails
        ? `${failedEmails} recruitment email delivery attempt(s) failed in the last 24 hours; ${sentEmails} were sent.`
        : `${sentEmails} recruitment email(s) sent in the last 24 hours with no logged failures.`
    ));
  }

  const appUrlOk=Boolean(String(env.APP_URL||"").trim());
  checks.push(item("app_url","Production app URL",appUrlOk?"pass":"warning",appUrlOk?"APP_URL is configured.":"APP_URL is not configured."));

  const verificationRequired=String(env.EMAIL_VERIFICATION_REQUIRED||"").trim().toLowerCase()==="true";
  checks.push(item("email_enforcement","Email verification enforcement",verificationRequired?"pass":"warning",verificationRequired?"New accounts must verify their email.":"EMAIL_VERIFICATION_REQUIRED is not enabled."));

  if(tables.has("admin_users")){
    const admins=await count(env,"SELECT COUNT(*) AS count FROM admin_users");
    checks.push(item("admins","Admin access",admins>0?"pass":"critical",admins>0?`${admins} admin account${admins===1?"":"s"} configured.`:"No admin account is configured."));
  }

  if(tables.has("users")&&tables.has("jobs")){
    const demoUsers=await count(env,"SELECT COUNT(*) AS count FROM users WHERE id='seed-employer'");
    const demoJobs=await count(env,"SELECT COUNT(*) AS count FROM jobs WHERE employer_id='seed-employer'");
    checks.push(item("demo_data","Built-in demo data",(demoUsers+demoJobs)?"warning":"pass",(demoUsers+demoJobs)?`${demoUsers} demo account and ${demoJobs} demo job record(s) remain.`:"Built-in demo data has been removed.",(demoUsers+demoJobs)?"remove_demo_data":null));

    const suspendedJobs=await count(env,`SELECT COUNT(*) AS count FROM jobs j JOIN users u ON u.id=j.employer_id WHERE u.is_suspended=1 AND j.status IN ('active','paused')`);
    checks.push(item("suspended_jobs","Jobs owned by suspended employers",suspendedJobs?"warning":"pass",suspendedJobs?`${suspendedJobs} open job(s) belong to suspended employer accounts.`:"No open jobs belong to suspended employers.",suspendedJobs?"close_suspended_jobs":null));
  }

  if(tables.has("privacy_preferences")&&tables.has("users")){
    const missingPrivacy=await count(env,`SELECT COUNT(*) AS count FROM users u LEFT JOIN privacy_preferences p ON p.user_id=u.id WHERE p.user_id IS NULL`);
    let missingCommercial=0;
    if(tables.has("employer_commercial_accounts")) missingCommercial=await count(env,`SELECT COUNT(*) AS count FROM users u LEFT JOIN employer_commercial_accounts eca ON eca.employer_id=u.id WHERE u.role='employer' AND eca.employer_id IS NULL`);
    let missingNotifications=0;
    if(tables.has("notification_preferences")) missingNotifications=await count(env,`SELECT COUNT(*) AS count FROM users u LEFT JOIN notification_preferences np ON np.user_id=u.id WHERE np.user_id IS NULL`);
    const total=missingPrivacy+missingCommercial+missingNotifications;
    checks.push(item("account_defaults","Account defaults",total?"warning":"pass",total?`${missingPrivacy} account(s) lack privacy defaults, ${missingNotifications} lack email preferences, and ${missingCommercial} employer account(s) lack commercial defaults.`:"Account default records are complete.",total?"repair_defaults":null));
  }

  if(tables.has("verified_emails")&&tables.has("users")){
    const unverified=await count(env,`SELECT COUNT(*) AS count FROM users u LEFT JOIN verified_emails ve ON ve.user_id=u.id WHERE u.id<>'seed-employer' AND u.is_suspended=0 AND ve.user_id IS NULL`);
    checks.push(item("unverified_accounts","Existing unverified accounts",unverified?"warning":"pass",unverified?`${unverified} active account(s) are not email verified.`:"All active non-demo accounts are email verified."));
  }

  if(tables.has("applications")&&tables.has("jobs")&&tables.has("users")){
    const orphanApps=await count(env,`SELECT COUNT(*) AS count FROM applications a LEFT JOIN jobs j ON j.id=a.job_id LEFT JOIN users u ON u.id=a.jobseeker_id WHERE j.id IS NULL OR u.id IS NULL`);
    let orphanInvites=0,orphanOffers=0;
    if(tables.has("interview_invites")) orphanInvites=await count(env,`SELECT COUNT(*) AS count FROM interview_invites ii LEFT JOIN applications a ON a.id=ii.application_id WHERE a.id IS NULL`);
    if(tables.has("job_offers")) orphanOffers=await count(env,`SELECT COUNT(*) AS count FROM job_offers o LEFT JOIN applications a ON a.id=o.application_id WHERE a.id IS NULL`);
    const total=orphanApps+orphanInvites+orphanOffers;
    checks.push(item("integrity","Recruitment data integrity",total?"critical":"pass",total?`${orphanApps} orphan application(s), ${orphanInvites} orphan interview(s), ${orphanOffers} orphan offer(s) found.`:"No orphaned application, interview or offer records detected."));
  }

  if(tables.has("interview_invites")){
    const stale=await count(env,`SELECT COUNT(*) AS count FROM interview_invites WHERE status='pending' AND datetime(interview_at)<datetime('now')`);
    checks.push(item("stale_interviews","Past pending interviews",stale?"warning":"pass",stale?`${stale} interview invitation(s) remain pending after their scheduled time.`:"No past interview invitations remain pending."));
  }

  if(tables.has("sessions")&&tables.has("auth_tokens")){
    const sessions=await count(env,"SELECT COUNT(*) AS count FROM sessions WHERE datetime(expires_at)<=datetime('now')");
    const tokens=await count(env,`SELECT COUNT(*) AS count FROM auth_tokens WHERE datetime(expires_at)<=datetime('now') OR used_at IS NOT NULL`);
    const total=sessions+tokens;
    checks.push(item("auth_cleanup","Expired authentication records",total?"info":"pass",total?`${sessions} expired session(s) and ${tokens} expired/used auth token(s) can be cleaned up.`:"No expired authentication records need cleanup.",total?"cleanup_auth":null));
  }

  if(tables.has("safety_reports")){
    const n=await count(env,"SELECT COUNT(*) AS count FROM safety_reports WHERE status IN ('open','reviewing')");
    checks.push(item("moderation_queue","Safety moderation queue",n?"info":"pass",n?`${n} safety report(s) are awaiting or undergoing review.`:"No safety reports are waiting for review."));
  }
  if(tables.has("employer_profiles")){
    const n=await count(env,"SELECT COUNT(*) AS count FROM employer_profiles WHERE verification_status='pending'");
    checks.push(item("verification_queue","Employer verification queue",n?"info":"pass",n?`${n} employer verification request(s) are pending.`:"No employer verification requests are pending."));
  }
  if(tables.has("pilot_issues")) {
    const n=await count(env,"SELECT COUNT(*) AS count FROM pilot_issues WHERE status IN ('open','reviewing')");
    checks.push(item("pilot_issue_queue","Pilot issue queue",n?"info":"pass",n?`${n} pilot issue(s) are awaiting or undergoing review.`:"No pilot issues are waiting for review."));
  }

  if(tables.has("commercial_plan_requests")){
    const n=await count(env,"SELECT COUNT(*) AS count FROM commercial_plan_requests WHERE status='pending'");
    checks.push(item("commercial_queue","Commercial request queue",n?"info":"pass",n?`${n} employer plan request(s) are pending.`:"No employer plan requests are pending."));
  }

  let checklist=[];
  if(tables.has("pilot_launch_checklist")){
    const {results}=await env.DB.prepare(`SELECT item_key AS itemKey,label,completed,completed_at AS completedAt FROM pilot_launch_checklist ORDER BY rowid`).all();
    checklist=results||[];
  }else checklist=LAUNCH_CHECKLIST.map(x=>({itemKey:x.key,label:x.label,completed:0,completedAt:null}));

  const summary={critical:0,warning:0,pass:0,info:0};
  for(const c of checks) if(summary[c.status]!==undefined) summary[c.status]++;
  const automatedReady=summary.critical===0;
  const checklistComplete=checklist.length>0&&checklist.every(x=>Boolean(x.completed));
  return json({automatedReady,checklistComplete,launchReady:automatedReady&&checklistComplete,checks,checklist,summary,checkedAt:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});
}
