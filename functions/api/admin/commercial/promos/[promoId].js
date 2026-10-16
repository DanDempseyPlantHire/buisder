import { json, err, newId, requireAdmin } from "../../../../_lib/db.js";

export async function onRequestPost(context) {
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
