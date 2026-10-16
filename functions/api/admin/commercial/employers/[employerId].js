import { json, err, newId, requireAdmin, createNotification } from "../../../../_lib/db.js";
import { applyPlan } from "../../../../_lib/commercial.js";

export async function onRequestPost(context) {
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
    title: "Buisder plan updated",
    body: `Your employer plan is now ${planCode}.`,
    eventKey: `commercial-plan:${employer.id}:${planCode}:${Date.now()}`
  });

  return json({ ok: true });
}
