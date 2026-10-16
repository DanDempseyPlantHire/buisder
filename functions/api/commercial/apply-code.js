import { json, err, newId, requireUser, createNotification } from "../../_lib/db.js";
import {
  ensureCommercialAccount, applyPlan, normalizeCommercialCode, accessEndFromDays
} from "../../_lib/commercial.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(context, "employer");
  if (error) return error;
  await ensureCommercialAccount(env, user.id);

  const body = await request.json().catch(() => null);
  const code = normalizeCommercialCode(body?.code);
  if (!code) return err("Enter a promo or referral code");

  const promo = await env.DB.prepare(
    `SELECT id, code, plan_code AS planCode, duration_days AS durationDays,
            max_redemptions AS maxRedemptions, redemption_count AS redemptionCount,
            active, expires_at AS expiresAt
     FROM commercial_promo_codes
     WHERE code=?`
  ).bind(code).first();

  if (promo) {
    if (!promo.active) return err("This promo code is no longer active");
    if (promo.expiresAt) {
      const expired = await env.DB.prepare(
        "SELECT CASE WHEN datetime(?) <= datetime('now') THEN 1 ELSE 0 END AS yes"
      ).bind(promo.expiresAt).first();
      if (expired?.yes) return err("This promo code has expired");
    }
    if (promo.maxRedemptions !== null && promo.maxRedemptions !== undefined &&
        Number(promo.redemptionCount || 0) >= Number(promo.maxRedemptions)) {
      return err("This promo code has reached its redemption limit");
    }

    const used = await env.DB.prepare(
      "SELECT id FROM commercial_promo_redemptions WHERE promo_id=? AND employer_id=?"
    ).bind(promo.id, user.id).first();
    if (used) return err("This promo code has already been used on this account");

    const current = await env.DB.prepare(
      "SELECT plan_code AS planCode FROM employer_commercial_accounts WHERE employer_id=?"
    ).bind(user.id).first();
    const endsAt = accessEndFromDays(promo.durationDays);

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO commercial_promo_redemptions
         (id, promo_id, employer_id, previous_plan_code, access_ends_at)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(newId(), promo.id, user.id, current?.planCode || "free", endsAt),
      env.DB.prepare(
        `UPDATE commercial_promo_codes
         SET redemption_count=redemption_count+1
         WHERE id=?`
      ).bind(promo.id)
    ]);

    await applyPlan(env, user.id, promo.planCode, {
      status: "trial",
      durationDays: promo.durationDays,
      source: "promo",
      actorUserId: user.id,
      description: `Promo code ${promo.code} applied for ${promo.durationDays} days.`
    });

    return json({ ok: true, type: "promo", planCode: promo.planCode });
  }

  const referral = await env.DB.prepare(
    `SELECT employer_id AS referrerEmployerId, code
     FROM employer_referral_codes WHERE code=?`
  ).bind(code).first();
  if (!referral) return err("Code not recognised", 404);
  if (referral.referrerEmployerId === user.id) return err("You cannot use your own referral code");

  const existing = await env.DB.prepare(
    "SELECT id FROM employer_referrals WHERE referred_employer_id=?"
  ).bind(user.id).first();
  if (existing) return err("A referral has already been recorded for this account", 409);

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO employer_referrals
       (id, referrer_employer_id, referred_employer_id, referral_code)
       VALUES (?, ?, ?, ?)`
    ).bind(newId(), referral.referrerEmployerId, user.id, code),
    env.DB.prepare(
      `INSERT INTO commercial_history
       (id, employer_id, event_type, description, actor_user_id)
       VALUES (?, ?, 'referral_recorded', ?, ?)`
    ).bind(newId(), user.id, `Referral code ${code} recorded.`, user.id)
  ]);

  await createNotification(env, {
    userId: referral.referrerEmployerId,
    type: "employer_referral",
    title: "Employer referral recorded",
    body: "An employer joined your Buisder referral network.",
    eventKey: `employer-referral:${user.id}`
  });

  return json({ ok: true, type: "referral" });
}
