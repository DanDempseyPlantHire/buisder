// Consolidated Pages Functions routes. Generated for Deas Jobs v24.4 compact deployment.
import { accessEndFromDays, applyPlan, ensureCommercialAccount, normalizeCommercialCode } from "../../_lib/commercial.js";
import { createNotification, err, json, newId, requireUser } from "../../_lib/db.js";
import { recordGrowthSignup } from "../../_lib/growth.js";

// Source route: apply-code.js
const route0 = (() => {
  async function onRequestPost(context) {
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
  
    try {
      await recordGrowthSignup(env, { userId:user.id, role:"employer", referralCode:code, attribution:{} });
    } catch (e) {
      // Commercial referral recording remains authoritative if v23 growth tracking is unavailable.
    }
  
    await createNotification(env, {
      userId: referral.referrerEmployerId,
      type: "employer_referral",
      title: "Employer referral recorded",
      body: "An employer joined your Deas Jobs referral network.",
      eventKey: `employer-referral:${user.id}`
    });
  
    return json({ ok: true, type: "referral" });
  }
  return { onRequestPost };
})();

// Source route: request-plan.js
const route1 = (() => {
  async function onRequestPost(context) {
    const { request, env } = context;
    const { user, error } = await requireUser(context, "employer");
    if (error) return error;
    await ensureCommercialAccount(env, user.id);
  
    const body = await request.json().catch(() => null);
    const planCode = String(body?.planCode || "").trim().toLowerCase();
    const message = String(body?.message || "").trim().slice(0, 1000);
  
    const plan = await env.DB.prepare(
      "SELECT code, name FROM commercial_plans WHERE code=? AND is_public=1"
    ).bind(planCode).first();
    if (!plan) return err("That plan is not available for self-service requests");
  
    const current = await env.DB.prepare(
      "SELECT plan_code FROM employer_commercial_accounts WHERE employer_id=?"
    ).bind(user.id).first();
    if (current?.plan_code === planCode) return err("You are already on this plan");
  
    const pending = await env.DB.prepare(
      "SELECT id FROM commercial_plan_requests WHERE employer_id=? AND status='pending' LIMIT 1"
    ).bind(user.id).first();
    if (pending) return err("You already have a plan request waiting for review", 409);
  
    const id = newId();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO commercial_plan_requests
         (id, employer_id, requested_plan_code, message)
         VALUES (?, ?, ?, ?)`
      ).bind(id, user.id, planCode, message),
      env.DB.prepare(
        `INSERT INTO commercial_history
         (id, employer_id, event_type, plan_code, description, actor_user_id)
         VALUES (?, ?, 'plan_requested', ?, ?, ?)`
      ).bind(newId(), user.id, planCode, `${plan.name} plan requested.`, user.id)
    ]);
  
    const { results: admins } = await env.DB.prepare("SELECT user_id AS userId FROM admin_users").all();
    for (const admin of admins || []) {
      await createNotification(env, {
        userId: admin.userId,
        type: "commercial_plan_request",
        title: "Employer plan request",
        body: `${user.name || user.email} requested the ${plan.name} plan.`,
        eventKey: `commercial-request:${id}:${admin.userId}`
      });
    }
  
    return json({ ok: true, id }, { status: 201 });
  }
  return { onRequestPost };
})();

const ROUTES = [
  { segments: ["apply-code"], handlers: route0 }, // apply-code.js
  { segments: ["request-plan"], handlers: route1 }, // request-plan.js
];

function tailParts(context) {
  const raw = context.params?.path;
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (raw === undefined || raw === null || raw === '') return [];
  return String(raw).split('/').filter(Boolean);
}

function matchSegments(pattern, actual) {
  if (pattern.length !== actual.length) return null;
  const params = {};
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i];
    const a = actual[i];
    const m = /^\[([^\]]+)\]$/.exec(p);
    if (m) params[m[1]] = a;
    else if (p !== a) return null;
  }
  return params;
}

async function dispatch(context, method) {
  const actual = tailParts(context);
  for (const route of ROUTES) {
    const extra = matchSegments(route.segments, actual);
    if (!extra) continue;
    const handler = route.handlers[method];
    if (!handler) return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'content-type': 'application/json; charset=utf-8' } });
    const nextContext = { ...context, params: { ...(context.params || {}), ...extra } };
    return handler(nextContext);
  }
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

export async function onRequestPost(context) { return dispatch(context, "onRequestPost"); }
