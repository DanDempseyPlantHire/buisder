import { json, err, newId, requireAdmin } from "../../../_lib/db.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const { user, error } = await requireAdmin(context);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return err("Invalid request body");

  const action = String(body.action || "").toLowerCase();
  if (!["approve", "reject"].includes(action)) return err("Action must be approve or reject");

  const target = await env.DB.prepare(
    `SELECT ep.user_id, ep.company_name, ep.verification_status, u.email
     FROM employer_profiles ep JOIN users u ON u.id=ep.user_id
     WHERE ep.user_id=?`
  ).bind(params.userId).first();
  if (!target) return err("Business profile not found", 404);

  const status = action === "approve" ? "verified" : "rejected";
  const note = String(body.note || (action === "approve" ? "Approved by Buisder admin" : "Verification rejected"));

  await env.DB.prepare(
    `UPDATE employer_profiles
     SET verification_status=?,
         verification_reviewed_at=datetime('now'),
         verification_note=?
     WHERE user_id=?`
  ).bind(status, note, params.userId).run();

  await env.DB.prepare(
    `INSERT INTO admin_audit_log
     (id, admin_user_id, action, target_type, target_id, details)
     VALUES (?, ?, ?, 'business_verification', ?, ?)`
  ).bind(
    newId(), user.id, action === "approve" ? "verification_approved" : "verification_rejected",
    params.userId,
    JSON.stringify({ companyName: target.company_name, email: target.email, note })
  ).run();

  return json({ ok: true, status });
}
