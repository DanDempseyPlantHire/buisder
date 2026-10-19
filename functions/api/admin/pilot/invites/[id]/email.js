import { json, err, newId, requireAdmin } from "../../../../../_lib/db.js";
import { appOrigin, sendEmail } from "../../../../../_lib/security.js";

function esc(v){return String(v||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}

export async function onRequestPost(context){
  const {request,env,params}=context; const {user,error}=await requireAdmin(context); if(error)return error;
  const body=await request.json().catch(()=>null); if(!body)return err("Invalid request body");
  const email=String(body.email||"").trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return err("Enter a valid email address");
  const invite=await env.DB.prepare(`SELECT pic.code,pic.label,pic.allowed_role AS allowedRole,pic.status,pic.expires_at AS expiresAt,pc.name AS cohortName,po.name AS organizationName FROM pilot_invite_codes pic LEFT JOIN pilot_cohorts pc ON pc.id=pic.cohort_id LEFT JOIN pilot_organizations po ON po.id=pic.organization_id WHERE pic.id=?`).bind(params.id).first();
  if(!invite)return err("Invite not found",404); if(invite.status!=="active")return err("Enable this invite before emailing it");
  const origin=appOrigin(env,request);
  const detail=[invite.allowedRole!=="any"?`Account type: ${invite.allowedRole}`:"",invite.cohortName?`Cohort: ${invite.cohortName}`:"",invite.organizationName?`Organisation: ${invite.organizationName}`:"",invite.expiresAt?`Expires: ${invite.expiresAt}`:""].filter(Boolean);
  const sent=await sendEmail(env,{to:email,subject:"Your DEASJobs pilot invitation",html:`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#182230;line-height:1.5"><h2>DEASJobs pilot invitation</h2><p>You have been invited to take part in the DEASJobs pilot.</p><p>Your invite code is:</p><p style="font-size:22px;font-weight:700;letter-spacing:.05em">${esc(invite.code)}</p>${detail.length?`<ul>${detail.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}${origin?`<p><a href="${esc(origin)}" style="display:inline-block;padding:11px 16px;background:#182230;color:#fff;text-decoration:none;border-radius:8px">Open DEASJobs</a></p>`:""}<p>Enter the invite code when creating your account, or in the Pilot section if you already have an account.</p></div>`,text:["DEASJobs pilot invitation","You have been invited to take part in the DEASJobs pilot.",`Invite code: ${invite.code}`,...detail,origin?`Open DEASJobs: ${origin}`:"","Enter the invite code during signup or in the Pilot section."].filter(Boolean).join("\n\n")});
  if(!sent.ok)return err("Pilot invitation email could not be sent. Check the Resend configuration.",502);
  await env.DB.prepare(`INSERT INTO admin_audit_log (id,admin_user_id,action,target_type,target_id,details) VALUES (?,?,'pilot_invite_emailed','pilot_invite',?,?)`).bind(newId(),user.id,params.id,JSON.stringify({email})).run();
  return json({ok:true});
}
