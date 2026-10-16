import { json, err, newId, requireAdmin } from "../../../../_lib/db.js";

export async function onRequestPost(context) {
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
