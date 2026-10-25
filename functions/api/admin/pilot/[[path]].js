// Deas Jobs v25.2 compact Functions: original endpoint handlers, grouped by route.
// Individual handlers and their authentication/validation logic are preserved.
// Do not restore the old route files when deploying this compact module.
import * as _import0 from "../../../_lib/db.js";
import * as _import1 from "../../../_lib/security.js";
import * as _import2 from "../../../_lib/pilot.js";

// Original: functions/api/admin/pilot/cohorts/[id].js
const _handler0 = (() => {
  const { json, err, requireAdmin } = _import0;
  const STATUSES = new Set(["planned","active","paused","completed"]);
  async function onRequestPost(context) {
    const { request, env, params } = context;
    const { error } = await requireAdmin(context); if (error) return error;
    const body = await request.json().catch(() => null); if (!body) return err("Invalid request body");
    const current = await env.DB.prepare("SELECT * FROM pilot_cohorts WHERE id=?").bind(params.id).first();
    if (!current) return err("Cohort not found",404);
    const name = String(body.name ?? current.name).trim().slice(0,140);
    const description = String(body.description ?? current.description ?? "").trim().slice(0,1000);
    const status = String(body.status ?? current.status);
    if (!name) return err("Cohort name is required"); if (!STATUSES.has(status)) return err("Invalid cohort status");
    await env.DB.prepare(`UPDATE pilot_cohorts SET name=?,description=?,status=?,starts_at=?,ends_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(name,description,status,body.startsAt ?? current.starts_at ?? null,body.endsAt ?? current.ends_at ?? null,params.id).run();
    return json({ok:true});
  }
  return { onRequestPost };
})();

// Original: functions/api/admin/pilot/cohorts/index.js
const _handler1 = (() => {
  const { json, err, newId, requireAdmin } = _import0;
  const STATUSES = new Set(["planned","active","paused","completed"]);

  async function onRequestPost(context) {
    const { request, env } = context;
    const { user, error } = await requireAdmin(context);
    if (error) return error;
    const body = await request.json().catch(() => null);
    if (!body) return err("Invalid request body");
    const name = String(body.name || "").trim().slice(0,140);
    const description = String(body.description || "").trim().slice(0,1000);
    const status = String(body.status || "planned");
    if (!name) return err("Cohort name is required");
    if (!STATUSES.has(status)) return err("Invalid cohort status");
    const id = newId();
    await env.DB.prepare(
      `INSERT INTO pilot_cohorts
       (id,name,description,status,starts_at,ends_at,created_by)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(id,name,description,status,body.startsAt || null,body.endsAt || null,user.id).run();
    return json({ ok:true,id }, { status:201 });
  }
  return { onRequestPost };
})();

// Original: functions/api/admin/pilot/invites/[id]/email.js
const _handler2 = (() => {
  const { json, err, newId, requireAdmin } = _import0;
  const { appOrigin, sendEmail } = _import1;
  function esc(v){return String(v||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}

  async function onRequestPost(context){
    const {request,env,params}=context; const {user,error}=await requireAdmin(context); if(error)return error;
    const body=await request.json().catch(()=>null); if(!body)return err("Invalid request body");
    const email=String(body.email||"").trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return err("Enter a valid email address");
    const invite=await env.DB.prepare(`SELECT pic.code,pic.label,pic.allowed_role AS allowedRole,pic.status,pic.expires_at AS expiresAt,pc.name AS cohortName,po.name AS organizationName FROM pilot_invite_codes pic LEFT JOIN pilot_cohorts pc ON pc.id=pic.cohort_id LEFT JOIN pilot_organizations po ON po.id=pic.organization_id WHERE pic.id=?`).bind(params.id).first();
    if(!invite)return err("Invite not found",404); if(invite.status!=="active")return err("Enable this invite before emailing it");
    const origin=appOrigin(env,request);
    const detail=[invite.allowedRole!=="any"?`Account type: ${invite.allowedRole}`:"",invite.cohortName?`Cohort: ${invite.cohortName}`:"",invite.organizationName?`Organisation: ${invite.organizationName}`:"",invite.expiresAt?`Expires: ${invite.expiresAt}`:""].filter(Boolean);
    const sent=await sendEmail(env,{to:email,subject:"Your Deas Jobs pilot invitation",html:`<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#182230;line-height:1.5"><h2>Deas Jobs pilot invitation</h2><p>You have been invited to take part in the Deas Jobs pilot.</p><p>Your invite code is:</p><p style="font-size:22px;font-weight:700;letter-spacing:.05em">${esc(invite.code)}</p>${detail.length?`<ul>${detail.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}${origin?`<p><a href="${esc(origin)}" style="display:inline-block;padding:11px 16px;background:#182230;color:#fff;text-decoration:none;border-radius:0">Open Deas Jobs</a></p>`:""}<p>Enter the invite code when creating your account, or in the Pilot section if you already have an account.</p></div>`,text:["Deas Jobs pilot invitation","You have been invited to take part in the Deas Jobs pilot.",`Invite code: ${invite.code}`,...detail,origin?`Open Deas Jobs: ${origin}`:"","Enter the invite code during signup or in the Pilot section."].filter(Boolean).join("\n\n")});
    if(!sent.ok)return err("Pilot invitation email could not be sent. Check the Resend configuration.",502);
    await env.DB.prepare(`INSERT INTO admin_audit_log (id,admin_user_id,action,target_type,target_id,details) VALUES (?,?,'pilot_invite_emailed','pilot_invite',?,?)`).bind(newId(),user.id,params.id,JSON.stringify({email})).run();
    return json({ok:true});
  }
  return { onRequestPost };
})();

// Original: functions/api/admin/pilot/invites/[id].js
const _handler3 = (() => {
  const { json, err, requireAdmin } = _import0;
  async function onRequestPost(context){
    const {request,env,params}=context; const {error}=await requireAdmin(context); if(error)return error;
    const body=await request.json().catch(()=>null); if(!body)return err("Invalid request body");
    const status=String(body.status||""); if(!["active","disabled"].includes(status))return err("Invalid invite status");
    const result=await env.DB.prepare("UPDATE pilot_invite_codes SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(status,params.id).run();
    if(!result.meta?.changes)return err("Invite not found",404); return json({ok:true});
  }
  return { onRequestPost };
})();

// Original: functions/api/admin/pilot/invites/index.js
const _handler4 = (() => {
  const { json, err, newId, requireAdmin } = _import0;
  const { normalizePilotCode } = _import2;
  const ROLES=new Set(["any","jobseeker","employer"]);
  function generated(){ return `BUI-${newId().replaceAll('-','').slice(0,8).toUpperCase()}`; }
  async function onRequestPost(context){
    const {request,env}=context; const {user,error}=await requireAdmin(context); if(error)return error;
    const body=await request.json().catch(()=>null); if(!body)return err("Invalid request body");
    const allowedRole=String(body.allowedRole||"any"); if(!ROLES.has(allowedRole))return err("Invalid invite role");
    const code=normalizePilotCode(body.code)||generated();
    const maxUses=body.maxUses===null||body.maxUses===undefined||body.maxUses===""?null:Number(body.maxUses);
    if(maxUses!==null && (!Number.isInteger(maxUses)||maxUses<1||maxUses>10000))return err("Max uses must be between 1 and 10000");
    const existing=await env.DB.prepare("SELECT id FROM pilot_invite_codes WHERE code=?").bind(code).first(); if(existing)return err("That invite code already exists",409);
    const id=newId();
    await env.DB.prepare(`INSERT INTO pilot_invite_codes (id,code,label,allowed_role,cohort_id,organization_id,max_uses,expires_at,status,created_by) VALUES (?,?,?,?,?,?,?,?, 'active', ?)`)
      .bind(id,code,String(body.label||"").trim().slice(0,140),allowedRole,body.cohortId||null,body.organizationId||null,maxUses,body.expiresAt||null,user.id).run();
    return json({ok:true,id,code},{status:201});
  }
  return { onRequestPost };
})();

// Original: functions/api/admin/pilot/issues/[id].js
const _handler5 = (() => {
  const { json, err, newId, requireAdmin, createNotification } = _import0;
  const STATUSES=new Set(["open","reviewing","resolved","closed"]);
  async function onRequestPost(context){
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
  return { onRequestPost };
})();

// Original: functions/api/admin/pilot/members/[userId].js
const _handler6 = (() => {
  const { json, err, newId, requireAdmin } = _import0;
  const STATUSES=new Set(["active","paused","completed","withdrawn"]);
  async function onRequestPost(context){
    const {request,env,params}=context; const {user,error}=await requireAdmin(context); if(error)return error;
    const body=await request.json().catch(()=>null); if(!body)return err("Invalid request body");
    const target=await env.DB.prepare("SELECT id FROM users WHERE id=?").bind(params.userId).first(); if(!target)return err("User not found",404);
    const status=String(body.status||"active"); if(!STATUSES.has(status))return err("Invalid membership status");
    const current=await env.DB.prepare("SELECT id FROM pilot_memberships WHERE user_id=?").bind(params.userId).first();
    if(current){
      await env.DB.prepare(`UPDATE pilot_memberships SET cohort_id=?,organization_id=?,status=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?`)
        .bind(body.cohortId||null,body.organizationId||null,status,String(body.notes||"").trim().slice(0,2000),params.userId).run();
    }else{
      await env.DB.prepare(`INSERT INTO pilot_memberships (id,user_id,cohort_id,organization_id,source,status,notes) VALUES (?,?,?,?, 'admin', ?, ?)`)
        .bind(newId(),params.userId,body.cohortId||null,body.organizationId||null,status,String(body.notes||"").trim().slice(0,2000)).run();
    }
    await env.DB.prepare(`INSERT INTO admin_audit_log (id,admin_user_id,action,target_type,target_id,details) VALUES (?,?,'pilot_membership_updated','user',?,?)`)
      .bind(newId(),user.id,params.userId,JSON.stringify({cohortId:body.cohortId||null,organizationId:body.organizationId||null,status})).run();
    return json({ok:true});
  }
  return { onRequestPost };
})();

// Original: functions/api/admin/pilot/members/index.js
const _handler7 = (() => {
  const { json, err, newId, requireAdmin } = _import0;
  const STATUSES=new Set(["active","paused","completed","withdrawn"]);
  async function onRequestPost(context){
    const {request,env}=context; const {user,error}=await requireAdmin(context); if(error)return error;
    const body=await request.json().catch(()=>null); if(!body)return err("Invalid request body");
    const email=String(body.email||"").trim().toLowerCase(); if(!email)return err("Email is required");
    const target=await env.DB.prepare("SELECT id,email,role FROM users WHERE lower(email)=?").bind(email).first(); if(!target)return err("No Deas Jobs account was found for that email",404);
    const status=String(body.status||"active"); if(!STATUSES.has(status))return err("Invalid membership status");
    const existing=await env.DB.prepare("SELECT id FROM pilot_memberships WHERE user_id=?").bind(target.id).first();
    if(existing){
      await env.DB.prepare(`UPDATE pilot_memberships SET cohort_id=?,organization_id=?,status=?,source='admin',updated_at=CURRENT_TIMESTAMP WHERE user_id=?`)
        .bind(body.cohortId||null,body.organizationId||null,status,target.id).run();
    }else{
      await env.DB.prepare(`INSERT INTO pilot_memberships (id,user_id,cohort_id,organization_id,source,status) VALUES (?,?,?,?, 'admin', ?)`)
        .bind(newId(),target.id,body.cohortId||null,body.organizationId||null,status).run();
    }
    await env.DB.prepare(`INSERT INTO admin_audit_log (id,admin_user_id,action,target_type,target_id,details) VALUES (?,?,'pilot_participant_added','user',?,?)`)
      .bind(newId(),user.id,target.id,JSON.stringify({email:target.email,role:target.role,cohortId:body.cohortId||null,organizationId:body.organizationId||null,status})).run();
    return json({ok:true,userId:target.id});
  }
  return { onRequestPost };
})();

// Original: functions/api/admin/pilot/organizations/[id].js
const _handler8 = (() => {
  const { json, err, requireAdmin } = _import0;
  const TYPES=new Set(["employer","school","college","youth_org","partner","other"]);
  const STATUSES=new Set(["planned","active","paused","completed"]);
  async function onRequestPost(context){
    const {request,env,params}=context; const {error}=await requireAdmin(context); if(error)return error;
    const body=await request.json().catch(()=>null); if(!body)return err("Invalid request body");
    const cur=await env.DB.prepare("SELECT * FROM pilot_organizations WHERE id=?").bind(params.id).first(); if(!cur)return err("Organisation not found",404);
    const name=String(body.name??cur.name).trim().slice(0,160), orgType=String(body.orgType??cur.org_type), status=String(body.status??cur.status);
    if(!name)return err("Organisation name is required"); if(!TYPES.has(orgType))return err("Invalid organisation type"); if(!STATUSES.has(status))return err("Invalid organisation status");
    await env.DB.prepare(`UPDATE pilot_organizations SET name=?,org_type=?,contact_name=?,contact_email=?,status=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(name,orgType,String(body.contactName??cur.contact_name??"").trim().slice(0,120),String(body.contactEmail??cur.contact_email??"").trim().toLowerCase().slice(0,200),status,String(body.notes??cur.notes??"").trim().slice(0,2000),params.id).run();
    return json({ok:true});
  }
  return { onRequestPost };
})();

// Original: functions/api/admin/pilot/organizations/index.js
const _handler9 = (() => {
  const { json, err, newId, requireAdmin } = _import0;
  const TYPES=new Set(["employer","school","college","youth_org","partner","other"]);
  const STATUSES=new Set(["planned","active","paused","completed"]);
  async function onRequestPost(context){
    const {request,env}=context; const {user,error}=await requireAdmin(context); if(error)return error;
    const body=await request.json().catch(()=>null); if(!body)return err("Invalid request body");
    const name=String(body.name||"").trim().slice(0,160); const orgType=String(body.orgType||"employer"); const status=String(body.status||"active");
    if(!name)return err("Organisation name is required"); if(!TYPES.has(orgType))return err("Invalid organisation type"); if(!STATUSES.has(status))return err("Invalid organisation status");
    const id=newId();
    await env.DB.prepare(`INSERT INTO pilot_organizations (id,name,org_type,contact_name,contact_email,status,notes,created_by) VALUES (?,?,?,?,?,?,?,?)`)
      .bind(id,name,orgType,String(body.contactName||"").trim().slice(0,120),String(body.contactEmail||"").trim().toLowerCase().slice(0,200),status,String(body.notes||"").trim().slice(0,2000),user.id).run();
    return json({ok:true,id},{status:201});
  }
  return { onRequestPost };
})();

// Original: functions/api/admin/pilot/settings.js
const _handler10 = (() => {
  const { json, err, newId, requireAdmin } = _import0;
  const STATUSES = new Set(["planned","active","paused","completed"]);

  async function onRequestPost(context) {
    const { request, env } = context;
    const { user, error } = await requireAdmin(context);
    if (error) return error;
    const body = await request.json().catch(() => null);
    if (!body) return err("Invalid request body");

    const pilotName = String(body.pilotName || "Deas Jobs Pilot").trim().slice(0,120) || "Deas Jobs Pilot";
    const status = String(body.status || "active");
    if (!STATUSES.has(status)) return err("Invalid pilot status");

    const inviteRequired = body.inviteRequired ? 1 : 0;
    const feedbackEnabled = body.feedbackEnabled ? 1 : 0;

    await env.DB.prepare(
      `INSERT INTO pilot_settings
       (id,pilot_name,invite_required,feedback_enabled,status,updated_by,updated_at)
       VALUES ('default',?,?,?,?,?,CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         pilot_name=excluded.pilot_name,
         invite_required=excluded.invite_required,
         feedback_enabled=excluded.feedback_enabled,
         status=excluded.status,
         updated_by=excluded.updated_by,
         updated_at=CURRENT_TIMESTAMP`
    ).bind(pilotName, inviteRequired, feedbackEnabled, status, user.id).run();

    await env.DB.prepare(
      `INSERT INTO admin_audit_log
       (id,admin_user_id,action,target_type,target_id,details)
       VALUES (?,?,'pilot_settings_updated','pilot','default',?)`
    ).bind(newId(), user.id, JSON.stringify({ pilotName, inviteRequired:Boolean(inviteRequired), feedbackEnabled:Boolean(feedbackEnabled), status })).run();

    return json({ ok:true });
  }
  return { onRequestPost };
})();

const ROUTES = [
  { segments:["cohorts", {name:"id"}], handler:_handler0 },
  { segments:["cohorts"], handler:_handler1 },
  { segments:["invites", {name:"id"}, "email"], handler:_handler2 },
  { segments:["invites", {name:"id"}], handler:_handler3 },
  { segments:["invites"], handler:_handler4 },
  { segments:["issues", {name:"id"}], handler:_handler5 },
  { segments:["members", {name:"userId"}], handler:_handler6 },
  { segments:["members"], handler:_handler7 },
  { segments:["organizations", {name:"id"}], handler:_handler8 },
  { segments:["organizations"], handler:_handler9 },
  { segments:["settings"], handler:_handler10 },
];

function routeSegments(request) {
  const url = new URL(request.url);
  const prefix = "/api/admin/pilot";
  let pathname = url.pathname;
  if (pathname !== prefix && !pathname.startsWith(prefix + "/")) return null;
  let tail = pathname.substring(prefix.length);
  tail = tail.replace(/^\/+|\/+$/g, "");
  if (!tail) return [];
  try { return tail.split("/").map(v => decodeURIComponent(v)); }
  catch { return null; }
}

export async function onRequest(context) {
  const segments = routeSegments(context.request);
  if (segments === null) return new Response("Not Found", { status: 404 });
  for (const route of ROUTES) {
    if (segments.length !== route.segments.length) continue;
    const params = {};
    let valid = true;
    for (let i = 0; i < segments.length; i++) {
      const matcher = route.segments[i];
      if (typeof matcher === "string") {
        if (matcher !== segments[i]) { valid = false; break; }
      } else {
        if (!segments[i]) { valid = false; break; }
        params[matcher.name] = segments[i];
      }
    }
    if (!valid) continue;
    const action = route.handler["onRequest" + context.request.method.toLowerCase().replace(/^./, x => x.toUpperCase())] || route.handler.onRequest;
    if (!action) {
      const allowed = Object.keys(route.handler).filter(x => x.startsWith("onRequest") && x !== "onRequest").map(x => x.slice(9).toUpperCase());
      return new Response("Method Not Allowed", { status: 405, headers: { Allow: allowed.join(", ") } });
    }
    // Inherit original request, env, data, waitUntil and next via the context prototype.
    return action(Object.assign(Object.create(context), { params: { ...(context.params || {}), ...params } }));
  }
  return new Response("Not Found", { status: 404 });
}
