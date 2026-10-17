import { json, err, newId, requireAdmin, createNotification } from "../../../../_lib/db.js";
const STATUSES=new Set(["open","reviewing","resolved","closed"]);
export async function onRequestPost(context){
  const {request,env,params}=context; const {user,error}=await requireAdmin(context); if(error)return error;
  const body=await request.json().catch(()=>null); if(!body)return err("Invalid request body");
  const status=String(body.status||""); if(!STATUSES.has(status))return err("Invalid issue status");
  const issue=await env.DB.prepare("SELECT id,reporter_user_id AS reporterUserId,title FROM pilot_issues WHERE id=?").bind(params.id).first(); if(!issue)return err("Issue not found",404);
  const note=String(body.adminNote||"").trim().slice(0,3000);
  await env.DB.prepare(`UPDATE pilot_issues SET status=?,admin_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .bind(status,note,user.id,params.id).run();
  await env.DB.prepare(`INSERT INTO admin_audit_log (id,admin_user_id,action,target_type,target_id,details) VALUES (?,?,'pilot_issue_updated','pilot_issue',?,?)`)
    .bind(newId(),user.id,params.id,JSON.stringify({status,note})).run();
  if(issue.reporterUserId && ["resolved","closed"].includes(status)){
    await createNotification(env,{userId:issue.reporterUserId,type:"pilot_issue_update",title:"Pilot issue updated",body:`Your pilot issue “${issue.title}” has been ${status}.`,eventKey:`pilot-issue-status:${params.id}:${status}`});
  }
  return json({ok:true});
}
