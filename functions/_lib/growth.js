import { newId } from "./db.js";

export function normalizeGrowthCode(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);
}

function randomHex(bytes = 5) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return [...data].map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export async function createUniqueGrowthCode(env, prefix = "BUI") {
  const cleanPrefix = String(prefix || "BUI").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) || "BUI";
  for (let i = 0; i < 8; i++) {
    const code = `${cleanPrefix}-${randomHex(4)}`;
    const exists = await env.DB.prepare("SELECT 1 FROM growth_referral_codes WHERE code=?").bind(code).first();
    if (!exists) return code;
  }
  return `${cleanPrefix}-${newId().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

export async function getValidGrowthCode(env, value, role) {
  const code = normalizeGrowthCode(value);
  if (!code) return { ok: true, code: null };
  const row = await env.DB.prepare(
    `SELECT id, code, referral_type AS referralType, target_role AS targetRole,
            owner_user_id AS ownerUserId, partner_id AS partnerId, campaign_id AS campaignId,
            status, max_uses AS maxUses, use_count AS useCount, expires_at AS expiresAt
     FROM growth_referral_codes WHERE code=?`
  ).bind(code).first();
  if (!row) return { ok: false, error: "Referral or partner code was not recognised." };
  if (row.status !== "active") return { ok: false, error: "This referral or partner code is not active." };
  if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) return { ok: false, error: "This referral or partner code has expired." };
  if (row.maxUses !== null && row.maxUses !== undefined && Number(row.useCount || 0) >= Number(row.maxUses)) {
    return { ok: false, error: "This referral or partner code has reached its usage limit." };
  }
  if (row.targetRole !== "any" && row.targetRole !== role) {
    return { ok: false, error: `This code is for ${row.targetRole === "jobseeker" ? "job seekers" : "employers"}.` };
  }
  return { ok: true, code: row };
}

function cleanAttr(value, max = 180) {
  const v = String(value || "").trim();
  return v ? v.slice(0, max) : null;
}

export async function recordGrowthSignup(env, { userId, role, referralCode, attribution = {} }) {
  const checked = await getValidGrowthCode(env, referralCode, role);
  if (!checked.ok) return checked;
  const code = checked.code;

  let campaignId = code?.campaignId || null;
  let partnerId = code?.partnerId || null;
  const utmCampaign = cleanAttr(attribution?.utmCampaign, 100);

  if (!campaignId && utmCampaign) {
    const campaign = await env.DB.prepare(
      `SELECT id, partner_id AS partnerId FROM growth_campaigns
       WHERE lower(campaign_key)=lower(?) AND status='active'
         AND (target_role='any' OR target_role=?)
         AND (starts_at IS NULL OR datetime(starts_at) <= datetime('now'))
         AND (ends_at IS NULL OR datetime(ends_at) > datetime('now'))
       LIMIT 1`
    ).bind(utmCampaign, role).first();
    if (campaign) {
      campaignId = campaign.id;
      partnerId = partnerId || campaign.partnerId || null;
    }
  }

  await env.DB.prepare(
    `INSERT OR IGNORE INTO growth_attribution
     (user_id, referral_code_id, partner_id, campaign_id,
      first_utm_source, first_utm_medium, first_utm_campaign, first_utm_content, first_utm_term, landing_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    userId,
    code?.id || null,
    partnerId,
    campaignId,
    cleanAttr(attribution?.utmSource, 100),
    cleanAttr(attribution?.utmMedium, 100),
    utmCampaign,
    cleanAttr(attribution?.utmContent, 100),
    cleanAttr(attribution?.utmTerm, 100),
    cleanAttr(attribution?.landingPath, 240)
  ).run();

  if (code) {
    if (code.ownerUserId === userId) return { ok: false, error: "A referral code cannot refer its own account." };
    const inserted = await env.DB.prepare(
      `INSERT OR IGNORE INTO growth_referrals
       (id, code_id, referrer_user_id, referred_user_id, partner_id, campaign_id, target_role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(newId(), code.id, code.ownerUserId || null, userId, partnerId, campaignId, role).run();
    if (Number(inserted?.meta?.changes || 0) > 0) {
      await env.DB.prepare(
        `UPDATE growth_referral_codes
         SET use_count = use_count + 1, updated_at=CURRENT_TIMESTAMP
         WHERE id=?`
      ).bind(code.id).run();
    }
  }

  return { ok: true, code };
}
