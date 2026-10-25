import { newId } from "./db.js";

export function normalizePilotCode(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

export async function getPilotSettings(env) {
  const row = await env.DB.prepare(
    `SELECT pilot_name AS pilotName,
            invite_required AS inviteRequired,
            feedback_enabled AS feedbackEnabled,
            status,
            updated_at AS updatedAt
     FROM pilot_settings WHERE id='default'`
  ).first();

  return row || {
    pilotName: "Deas Jobs Pilot",
    inviteRequired: 0,
    feedbackEnabled: 1,
    status: "active",
    updatedAt: null
  };
}

export async function validatePilotInvite(env, rawCode, role) {
  const code = normalizePilotCode(rawCode);
  if (!code) return { ok:false, error:"Enter a pilot invite code." };

  const invite = await env.DB.prepare(
    `SELECT pic.id, pic.code, pic.label,
            pic.allowed_role AS allowedRole,
            pic.cohort_id AS cohortId,
            pic.organization_id AS organizationId,
            pic.max_uses AS maxUses,
            pic.expires_at AS expiresAt,
            pic.status,
            pc.name AS cohortName,
            po.name AS organizationName,
            (SELECT COUNT(*) FROM pilot_invite_redemptions pir WHERE pir.invite_code_id=pic.id) AS useCount
     FROM pilot_invite_codes pic
     LEFT JOIN pilot_cohorts pc ON pc.id=pic.cohort_id
     LEFT JOIN pilot_organizations po ON po.id=pic.organization_id
     WHERE pic.code=?`
  ).bind(code).first();

  if (!invite) return { ok:false, error:"Pilot invite code was not found." };
  if (invite.status !== "active") return { ok:false, error:"This pilot invite code is disabled." };

  if (invite.expiresAt) {
    const valid = await env.DB.prepare(
      "SELECT CASE WHEN datetime(?) > datetime('now') THEN 1 ELSE 0 END AS valid"
    ).bind(invite.expiresAt).first();
    if (!valid?.valid) return { ok:false, error:"This pilot invite code has expired." };
  }

  if (invite.allowedRole !== "any" && role && invite.allowedRole !== role) {
    return { ok:false, error:`This invite code is for ${invite.allowedRole} accounts.` };
  }

  if (invite.maxUses !== null && invite.maxUses !== undefined && Number(invite.useCount || 0) >= Number(invite.maxUses)) {
    return { ok:false, error:"This pilot invite code has reached its usage limit." };
  }

  return { ok:true, invite:{ ...invite, code } };
}

export async function joinPilotByInvite(env, user, rawCode) {
  const existing = await env.DB.prepare(
    `SELECT pm.id, pm.user_id AS userId, pm.status,
            pm.cohort_id AS cohortId, pm.organization_id AS organizationId,
            pc.name AS cohortName, po.name AS organizationName
     FROM pilot_memberships pm
     LEFT JOIN pilot_cohorts pc ON pc.id=pm.cohort_id
     LEFT JOIN pilot_organizations po ON po.id=pm.organization_id
     WHERE pm.user_id=?`
  ).bind(user.id).first();

  if (existing) {
    return { ok:true, alreadyMember:true, membership:existing };
  }

  const checked = await validatePilotInvite(env, rawCode, user.role);
  if (!checked.ok) return checked;

  // Re-check usage as close as possible to redemption.
  if (checked.invite.maxUses !== null && checked.invite.maxUses !== undefined) {
    const current = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM pilot_invite_redemptions WHERE invite_code_id=?"
    ).bind(checked.invite.id).first();
    if (Number(current?.count || 0) >= Number(checked.invite.maxUses)) {
      return { ok:false, error:"This pilot invite code has reached its usage limit." };
    }
  }

  const membershipId = newId();
  const redemptionId = newId();

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO pilot_memberships
       (id, user_id, cohort_id, organization_id, invite_code_id, source, status)
       VALUES (?, ?, ?, ?, ?, 'invite_code', 'active')`
    ).bind(
      membershipId,
      user.id,
      checked.invite.cohortId || null,
      checked.invite.organizationId || null,
      checked.invite.id
    ),
    env.DB.prepare(
      `INSERT INTO pilot_invite_redemptions
       (id, invite_code_id, user_id)
       VALUES (?, ?, ?)`
    ).bind(redemptionId, checked.invite.id, user.id)
  ]);

  return {
    ok:true,
    membership:{
      id:membershipId,
      userId:user.id,
      status:"active",
      cohortId:checked.invite.cohortId || null,
      cohortName:checked.invite.cohortName || null,
      organizationId:checked.invite.organizationId || null,
      organizationName:checked.invite.organizationName || null
    }
  };
}

export async function getPilotMemberSnapshot(env, userId) {
  const settings = await getPilotSettings(env);
  const membership = await env.DB.prepare(
    `SELECT pm.id, pm.status, pm.source, pm.joined_at AS joinedAt,
            pm.updated_at AS updatedAt, pm.notes,
            pm.cohort_id AS cohortId, pc.name AS cohortName,
            pc.status AS cohortStatus,
            pm.organization_id AS organizationId, po.name AS organizationName,
            po.org_type AS organizationType
     FROM pilot_memberships pm
     LEFT JOIN pilot_cohorts pc ON pc.id=pm.cohort_id
     LEFT JOIN pilot_organizations po ON po.id=pm.organization_id
     WHERE pm.user_id=?`
  ).bind(userId).first();

  const { results: feedback } = await env.DB.prepare(
    `SELECT id, feedback_type AS feedbackType, rating,
            ease_score AS easeScore, recommend_score AS recommendScore,
            comments, created_at AS createdAt
     FROM pilot_feedback
     WHERE user_id=?
     ORDER BY created_at DESC LIMIT 20`
  ).bind(userId).all();

  const { results: issues } = await env.DB.prepare(
    `SELECT id, category, severity, title, details, status,
            admin_note AS adminNote, created_at AS createdAt,
            updated_at AS updatedAt
     FROM pilot_issues
     WHERE reporter_user_id=?
     ORDER BY created_at DESC LIMIT 30`
  ).bind(userId).all();

  return {
    settings,
    membership:membership || null,
    feedback:feedback || [],
    issues:issues || []
  };
}
