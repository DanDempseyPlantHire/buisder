// Consolidated Pages Functions routes. Generated for Deas Jobs v24.4 compact deployment.
import { applyPlan, normalizeCommercialCode } from "../../../_lib/commercial.js";
import { createNotification, err, json, newId, requireAdmin } from "../../../_lib/db.js";

// Source route: employers/[employerId].js
const route0 = (() => {
  async function onRequestPost(context) {
    const { request, env, params } = context;
    const { user, error } = await requireAdmin(context);
    if (error) return error;
  
    const employer = await env.DB.prepare(
      "SELECT id, email, name FROM users WHERE id=? AND role='employer'"
    ).bind(params.employerId).first();
    if (!employer) return err("Employer not found", 404);
  
    const body = await request.json().catch(() => null);
    if (!body) return err("Invalid request body");
  
    const planCode = String(body.planCode || "").trim().toLowerCase();
    const status = body.status === "trial" ? "trial" : "active";
    const durationDays = body.durationDays === "" || body.durationDays === null || body.durationDays === undefined
      ? null : Number(body.durationDays);
    if (status === "trial" && (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650)) {
      return err("Trial duration must be between 1 and 3650 days");
    }
  
    try {
      await applyPlan(env, employer.id, planCode, {
        status,
        durationDays: status === "trial" ? durationDays : null,
        source: "admin",
        actorUserId: user.id,
        description: String(body.note || "").trim().slice(0, 500) || undefined
      });
    } catch (e) {
      return err(e?.message || "Could not assign plan");
    }
  
    await env.DB.prepare(
      `INSERT INTO admin_audit_log
       (id, admin_user_id, action, target_type, target_id, details)
       VALUES (?, ?, 'commercial_plan_assigned', 'employer', ?, ?)`
    ).bind(newId(), user.id, employer.id, JSON.stringify({ planCode, status, durationDays })).run();
  
    await createNotification(env, {
      userId: employer.id,
      type: "commercial_plan_update",
      title: "Deas Jobs plan updated",
      body: `Your employer plan is now ${planCode}.`,
      eventKey: `commercial-plan:${employer.id}:${planCode}:${Date.now()}`
    });
  
    return json({ ok: true });
  }
  return { onRequestPost };
})();

// Source route: plans/[code].js
const route1 = (() => {
  async function onRequestPost(context) {
    const { request, env, params } = context;
    const { user, error } = await requireAdmin(context);
    if (error) return error;
  
    const current = await env.DB.prepare("SELECT * FROM commercial_plans WHERE code=?")
      .bind(params.code).first();
    if (!current) return err("Plan not found", 404);
  
    const body = await request.json().catch(() => null);
    if (!body) return err("Invalid request body");
  
    const name = String(body.name ?? current.name).trim().slice(0, 80);
    const description = String(body.description ?? current.description ?? "").trim().slice(0, 500);
    const priceMode = String(body.priceMode ?? current.price_mode).toLowerCase();
    if (!["free","unset","fixed"].includes(priceMode)) return err("Invalid pricing mode");
  
    let monthlyPriceCents = null;
    if (priceMode === "free") monthlyPriceCents = 0;
    if (priceMode === "fixed") {
      monthlyPriceCents = Number(body.monthlyPriceCents);
      if (!Number.isInteger(monthlyPriceCents) || monthlyPriceCents < 0) return err("Monthly price must be a valid amount");
    }
  
    const activeJobLimit = Number(body.activeJobLimit);
    const featuredJobLimit = Number(body.featuredJobLimit);
    if (!Number.isInteger(activeJobLimit) || activeJobLimit < 1) return err("Active job limit must be at least 1");
    if (!Number.isInteger(featuredJobLimit) || featuredJobLimit < 0) return err("Featured job limit cannot be negative");
  
    const isPublic = body.isPublic ? 1 : 0;
  
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE commercial_plans
         SET name=?, description=?, price_mode=?, monthly_price_cents=?,
             active_job_limit=?, featured_job_limit=?, is_public=?, updated_at=CURRENT_TIMESTAMP
         WHERE code=?`
      ).bind(name, description, priceMode, monthlyPriceCents, activeJobLimit, featuredJobLimit, isPublic, params.code),
      env.DB.prepare(
        `INSERT INTO admin_audit_log
         (id, admin_user_id, action, target_type, target_id, details)
         VALUES (?, ?, 'commercial_plan_updated', 'commercial_plan', ?, ?)`
      ).bind(newId(), user.id, params.code, JSON.stringify({ priceMode, monthlyPriceCents, activeJobLimit, featuredJobLimit, isPublic }))
    ]);
  
    return json({ ok: true });
  }
  return { onRequestPost };
})();

// Source route: promos/[promoId].js
const route2 = (() => {
  async function onRequestPost(context) {
    const { request, env, params } = context;
    const { user, error } = await requireAdmin(context);
    if (error) return error;
  
    const body = await request.json().catch(() => null);
    const action = String(body?.action || "").toLowerCase();
    if (!["activate","deactivate"].includes(action)) return err("Action must be activate or deactivate");
  
    const promo = await env.DB.prepare("SELECT id, code FROM commercial_promo_codes WHERE id=?")
      .bind(params.promoId).first();
    if (!promo) return err("Promo not found", 404);
  
    const active = action === "activate" ? 1 : 0;
    await env.DB.batch([
      env.DB.prepare("UPDATE commercial_promo_codes SET active=? WHERE id=?").bind(active, promo.id),
      env.DB.prepare(
        `INSERT INTO admin_audit_log
         (id, admin_user_id, action, target_type, target_id, details)
         VALUES (?, ?, ?, 'commercial_promo', ?, ?)`
      ).bind(newId(), user.id, active ? "promo_activated" : "promo_deactivated", promo.id, JSON.stringify({ code: promo.code }))
    ]);
  
    return json({ ok: true, active: Boolean(active) });
  }
  return { onRequestPost };
})();

// Source route: promos/index.js
const route3 = (() => {
  async function onRequestPost(context) {
    const { request, env } = context;
    const { user, error } = await requireAdmin(context);
    if (error) return error;
  
    const body = await request.json().catch(() => null);
    if (!body) return err("Invalid request body");
  
    const code = normalizeCommercialCode(body.code);
    const planCode = String(body.planCode || "").trim().toLowerCase();
    const durationDays = Number(body.durationDays || 30);
    const maxRedemptions = body.maxRedemptions === "" || body.maxRedemptions === null || body.maxRedemptions === undefined
      ? null : Number(body.maxRedemptions);
    const expiresAt = body.expiresAt ? String(body.expiresAt).trim() : null;
  
    if (!/^[A-Z0-9_-]{4,40}$/.test(code)) return err("Promo code must be 4–40 letters, numbers, underscores or hyphens");
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) return err("Duration must be between 1 and 3650 days");
    if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1)) return err("Redemption limit must be blank or at least 1");
  
    const plan = await env.DB.prepare("SELECT code FROM commercial_plans WHERE code=?").bind(planCode).first();
    if (!plan) return err("Plan not found");
  
    const id = newId();
    try {
      await env.DB.prepare(
        `INSERT INTO commercial_promo_codes
         (id, code, plan_code, duration_days, max_redemptions, expires_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, code, planCode, durationDays, maxRedemptions, expiresAt, user.id).run();
    } catch (e) {
      if (/unique/i.test(String(e?.message || e))) return err("That promo code already exists", 409);
      throw e;
    }
  
    await env.DB.prepare(
      `INSERT INTO admin_audit_log
       (id, admin_user_id, action, target_type, target_id, details)
       VALUES (?, ?, 'promo_created', 'commercial_promo', ?, ?)`
    ).bind(newId(), user.id, id, JSON.stringify({ code, planCode, durationDays, maxRedemptions, expiresAt })).run();
  
    return json({ ok: true, id, code }, { status: 201 });
  }
  return { onRequestPost };
})();

// Source route: requests/[requestId].js
const route4 = (() => {
  async function onRequestPost(context) {
    const { request, env, params } = context;
    const { user, error } = await requireAdmin(context);
    if (error) return error;
  
    const body = await request.json().catch(() => null);
    const action = String(body?.action || "").toLowerCase();
    if (!["approve","reject"].includes(action)) return err("Action must be approve or reject");
  
    const req = await env.DB.prepare(
      `SELECT r.id, r.employer_id AS employerId, r.requested_plan_code AS planCode,
              r.status, p.name AS planName
       FROM commercial_plan_requests r
       JOIN commercial_plans p ON p.code=r.requested_plan_code
       WHERE r.id=?`
    ).bind(params.requestId).first();
    if (!req) return err("Plan request not found", 404);
    if (req.status !== "pending") return err("This request has already been reviewed");
  
    const note = String(body?.note || "").trim().slice(0, 500);
    const trialDays = body?.trialDays === "" || body?.trialDays === undefined || body?.trialDays === null
      ? null : Number(body.trialDays);
    if (trialDays !== null && (!Number.isInteger(trialDays) || trialDays < 1 || trialDays > 3650)) {
      return err("Trial duration must be between 1 and 3650 days");
    }
  
    if (action === "approve") {
      await applyPlan(env, req.employerId, req.planCode, {
        status: trialDays ? "trial" : "active",
        durationDays: trialDays,
        source: "upgrade_request",
        actorUserId: user.id,
        description: note || `${req.planName} request approved.`
      });
    }
  
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE commercial_plan_requests
         SET status=?, reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP, admin_note=?
         WHERE id=?`
      ).bind(action === "approve" ? "approved" : "rejected", user.id, note, req.id),
      env.DB.prepare(
        `INSERT INTO admin_audit_log
         (id, admin_user_id, action, target_type, target_id, details)
         VALUES (?, ?, ?, 'commercial_plan_request', ?, ?)`
      ).bind(newId(), user.id, action === "approve" ? "commercial_request_approved" : "commercial_request_rejected", req.id, JSON.stringify({ planCode: req.planCode, trialDays }))
    ]);
  
    await createNotification(env, {
      userId: req.employerId,
      type: "commercial_plan_request_update",
      title: action === "approve" ? "Plan request approved" : "Plan request reviewed",
      body: action === "approve"
        ? `Your request for the ${req.planName} plan was approved.`
        : `Your request for the ${req.planName} plan was not approved at this time.`,
      eventKey: `commercial-request-result:${req.id}:${action}`
    });
  
    return json({ ok: true, status: action === "approve" ? "approved" : "rejected" });
  }
  return { onRequestPost };
})();

const ROUTES = [
  { segments: ["employers", "[employerId]"], handlers: route0 }, // employers/[employerId].js
  { segments: ["plans", "[code]"], handlers: route1 }, // plans/[code].js
  { segments: ["promos", "[promoId]"], handlers: route2 }, // promos/[promoId].js
  { segments: ["promos"], handlers: route3 }, // promos/index.js
  { segments: ["requests", "[requestId]"], handlers: route4 }, // requests/[requestId].js
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
