import { json, err, newId, requireAdmin } from "../../../../_lib/db.js";
import { normalizeCommercialCode } from "../../../../_lib/commercial.js";

export async function onRequestPost(context) {
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
