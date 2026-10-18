import { json, err, newId, requireUser } from "../../_lib/db.js";
import { createUniqueGrowthCode } from "../../_lib/growth.js";

async function responseFor(env, user) {
  const type = user.role === "employer" ? "employer" : "candidate";
  const code = await env.DB.prepare(
    `SELECT id, code, referral_type AS referralType, target_role AS targetRole,
            status, max_uses AS maxUses, use_count AS useCount, expires_at AS expiresAt
     FROM growth_referral_codes
     WHERE owner_user_id=? AND referral_type=?
     ORDER BY created_at ASC LIMIT 1`
  ).bind(user.id, type).first();

  let stats = { signups:0, activated:0, converted:0 };
  if (code) {
    if (user.role === "jobseeker") {
      const row = await env.DB.prepare(
        `SELECT COUNT(DISTINCT gr.referred_user_id) AS signups,
                COUNT(DISTINCT CASE WHEN COALESCE(jp.onboarding_complete,0)=1 THEN gr.referred_user_id END) AS activated,
                COUNT(DISTINCT CASE WHEN a.status='hired' THEN gr.referred_user_id END) AS converted
         FROM growth_referrals gr
         LEFT JOIN jobseeker_profiles jp ON jp.user_id=gr.referred_user_id
         LEFT JOIN applications a ON a.jobseeker_id=gr.referred_user_id
         WHERE gr.code_id=? AND gr.target_role='jobseeker'`
      ).bind(code.id).first();
      stats = { signups:Number(row?.signups||0), activated:Number(row?.activated||0), converted:Number(row?.converted||0) };
    } else {
      const row = await env.DB.prepare(
        `SELECT COUNT(DISTINCT gr.referred_user_id) AS signups,
                COUNT(DISTINCT CASE WHEN ep.verification_status='verified' THEN gr.referred_user_id END) AS activated,
                COUNT(DISTINCT CASE WHEN j.id IS NOT NULL THEN gr.referred_user_id END) AS converted
         FROM growth_referrals gr
         LEFT JOIN employer_profiles ep ON ep.user_id=gr.referred_user_id
         LEFT JOIN jobs j ON j.employer_id=gr.referred_user_id
         WHERE gr.code_id=? AND gr.target_role='employer'`
      ).bind(code.id).first();
      stats = { signups:Number(row?.signups||0), activated:Number(row?.activated||0), converted:Number(row?.converted||0) };
    }
  }
  return { code: code || null, sharePath: code ? `/join/${encodeURIComponent(code.code)}` : null, stats };
}

export async function onRequestGet(context) {
  const { env } = context;
  const { user, error } = await requireUser(context);
  if (error) return error;
  return json(await responseFor(env, user), { headers:{"Cache-Control":"no-store"} });
}

export async function onRequestPost(context) {
  const { env } = context;
  const { user, error } = await requireUser(context);
  if (error) return error;
  const type = user.role === "employer" ? "employer" : "candidate";
  const existing = await env.DB.prepare(
    "SELECT id FROM growth_referral_codes WHERE owner_user_id=? AND referral_type=? LIMIT 1"
  ).bind(user.id, type).first();
  if (!existing) {
    const code = await createUniqueGrowthCode(env, user.role === "employer" ? "EMP" : "JOB");
    await env.DB.prepare(
      `INSERT INTO growth_referral_codes
       (id, code, referral_type, target_role, owner_user_id, label, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(newId(), code, type, user.role, user.id, "Personal referral link", user.id).run();
  }
  return json(await responseFor(env, user), { status: existing ? 200 : 201, headers:{"Cache-Control":"no-store"} });
}
