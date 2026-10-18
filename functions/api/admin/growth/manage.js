import { json, err, newId, requireAdmin } from "../../../_lib/db.js";
import { createUniqueGrowthCode, normalizeGrowthCode } from "../../../_lib/growth.js";

const PARTNER_TYPES = new Set(["school","college","youth_org","community","employer_network","other"]);
const PARTNER_STATUSES = new Set(["prospect","active","paused","closed"]);
const CAMPAIGN_STATUSES = new Set(["draft","active","paused","ended"]);
const TARGET_ROLES = new Set(["any","jobseeker","employer"]);
const REFERRAL_TYPES = new Set(["candidate","employer","partner","campaign"]);
const CODE_STATUSES = new Set(["active","paused"]);
const LEAD_STAGES = new Set(["prospect","contacted","interested","invited","registered","verified","first_job","active"]);

function clean(v, max=500){ return String(v ?? "").trim().slice(0,max); }
function nullable(v, max=500){ const x=clean(v,max); return x || null; }
async function audit(env, adminId, action, targetType, targetId, details){
  await env.DB.prepare(`INSERT INTO admin_audit_log(id,admin_user_id,action,target_type,target_id,details) VALUES(?,?,?,?,?,?)`)
    .bind(newId(), adminId, action, targetType, targetId, details ? JSON.stringify(details) : null).run();
}

export async function onRequestPost(context){
  const { request, env } = context;
  const { user, error } = await requireAdmin(context);
  if (error) return error;
  const body = await request.json().catch(()=>null);
  if (!body) return err("Invalid request body");
  const action = clean(body.action,60);

  if (action === "create_partner") {
    const name=clean(body.name,160), partnerType=clean(body.partnerType,40)||"other", status=clean(body.status,30)||"active";
    if (!name) return err("Partner name is required");
    if (!PARTNER_TYPES.has(partnerType) || !PARTNER_STATUSES.has(status)) return err("Invalid partner type or status");
    const id=newId();
    await env.DB.prepare(`INSERT INTO growth_partners(id,name,partner_type,contact_name,contact_email,region,status,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?)`)
      .bind(id,name,partnerType,nullable(body.contactName,160),nullable(body.contactEmail,254),nullable(body.region,160),status,nullable(body.notes,2000),user.id).run();
    await audit(env,user.id,"growth_partner_created","growth_partner",id,{name});
    return json({ok:true,id},{status:201});
  }

  if (action === "update_partner") {
    const id=clean(body.id,80), status=clean(body.status,30);
    if (!id || !PARTNER_STATUSES.has(status)) return err("Valid partner and status are required");
    await env.DB.prepare(`UPDATE growth_partners SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(status,id).run();
    await audit(env,user.id,"growth_partner_updated","growth_partner",id,{status});
    return json({ok:true});
  }

  if (action === "create_campaign") {
    const name=clean(body.name,160), key=clean(body.campaignKey,100).toLowerCase().replace(/[^a-z0-9_-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"");
    const targetRole=clean(body.targetRole,30)||"any", status=clean(body.status,30)||"active";
    if (!name || !key) return err("Campaign name and campaign key are required");
    if (!TARGET_ROLES.has(targetRole) || !CAMPAIGN_STATUSES.has(status)) return err("Invalid campaign role or status");
    const id=newId();
    try{
      await env.DB.prepare(`INSERT INTO growth_campaigns(id,name,campaign_key,source,medium,target_role,partner_id,landing_path,status,starts_at,ends_at,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id,name,key,clean(body.source,100)||"direct",clean(body.medium,100)||"referral",targetRole,nullable(body.partnerId,80),clean(body.landingPath,240)||"/",status,nullable(body.startsAt,40),nullable(body.endsAt,40),nullable(body.notes,2000),user.id).run();
    }catch(e){ if(/unique/i.test(String(e?.message||e))) return err("That campaign key already exists",409); throw e; }
    await audit(env,user.id,"growth_campaign_created","growth_campaign",id,{name,key});
    return json({ok:true,id},{status:201});
  }

  if (action === "update_campaign") {
    const id=clean(body.id,80), status=clean(body.status,30);
    if (!id || !CAMPAIGN_STATUSES.has(status)) return err("Valid campaign and status are required");
    await env.DB.prepare(`UPDATE growth_campaigns SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(status,id).run();
    await audit(env,user.id,"growth_campaign_updated","growth_campaign",id,{status});
    return json({ok:true});
  }

  if (action === "create_code") {
    const referralType=clean(body.referralType,30)||"campaign", targetRole=clean(body.targetRole,30)||"any";
    if (!REFERRAL_TYPES.has(referralType) || !TARGET_ROLES.has(targetRole)) return err("Invalid referral type or target role");
    let code=normalizeGrowthCode(body.code);
    if (!code) code=await createUniqueGrowthCode(env, referralType==="partner"?"PAR":referralType==="employer"?"EMP":referralType==="candidate"?"JOB":"CAM");
    const id=newId();
    try{
      await env.DB.prepare(`INSERT INTO growth_referral_codes(id,code,referral_type,target_role,partner_id,campaign_id,label,status,max_uses,expires_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id,code,referralType,targetRole,nullable(body.partnerId,80),nullable(body.campaignId,80),nullable(body.label,160),"active",body.maxUses?Number(body.maxUses):null,nullable(body.expiresAt,40),user.id).run();
    }catch(e){ if(/unique/i.test(String(e?.message||e))) return err("That referral code already exists",409); throw e; }
    await audit(env,user.id,"growth_code_created","growth_referral_code",id,{code,referralType,targetRole});
    return json({ok:true,id,code},{status:201});
  }

  if (action === "update_code") {
    const id=clean(body.id,80), status=clean(body.status,30);
    if (!id || !CODE_STATUSES.has(status)) return err("Valid code and status are required");
    await env.DB.prepare(`UPDATE growth_referral_codes SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(status,id).run();
    await audit(env,user.id,"growth_code_updated","growth_referral_code",id,{status});
    return json({ok:true});
  }

  if (action === "create_lead") {
    const businessName=clean(body.businessName,180), stage=clean(body.stage,30)||"prospect";
    if (!businessName) return err("Business name is required");
    if (!LEAD_STAGES.has(stage)) return err("Invalid pipeline stage");
    let linkedEmployerId=null;
    const linkedEmail=clean(body.linkedEmployerEmail,254).toLowerCase();
    if (linkedEmail) {
      const found=await env.DB.prepare("SELECT id FROM users WHERE lower(email)=? AND role='employer'").bind(linkedEmail).first();
      linkedEmployerId=found?.id||null;
    }
    const id=newId();
    await env.DB.prepare(`INSERT INTO growth_employer_leads(id,business_name,contact_name,contact_email,location,stage,source,partner_id,campaign_id,linked_employer_id,notes,next_follow_up_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id,businessName,nullable(body.contactName,160),nullable(body.contactEmail,254),nullable(body.location,160),stage,nullable(body.source,160),nullable(body.partnerId,80),nullable(body.campaignId,80),linkedEmployerId,nullable(body.notes,3000),nullable(body.nextFollowUpAt,40),user.id).run();
    await audit(env,user.id,"growth_lead_created","growth_employer_lead",id,{businessName,stage});
    return json({ok:true,id},{status:201});
  }

  if (action === "update_lead") {
    const id=clean(body.id,80), stage=clean(body.stage,30);
    if (!id || !LEAD_STAGES.has(stage)) return err("Valid lead and stage are required");
    await env.DB.prepare(`UPDATE growth_employer_leads SET stage=?, next_follow_up_at=?, notes=COALESCE(?,notes), updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(stage,nullable(body.nextFollowUpAt,40),nullable(body.notes,3000),id).run();
    await audit(env,user.id,"growth_lead_updated","growth_employer_lead",id,{stage});
    return json({ok:true});
  }

  return err("Unknown growth action",400);
}
