import { json, err, newId, requireAdmin } from "../../../_lib/db.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const { user, error } = await requireAdmin(context);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return err("Invalid request body");

  const action = String(body.action || "").toLowerCase();
  if (!["suspend", "restore"].includes(action)) return err("Action must be suspend or restore");
  if (params.userId === user.id) return err("You cannot suspend your own admin account", 400);

  const target = await env.DB.prepare(
    "SELECT id, email, name, role, is_suspended FROM users WHERE id=?"
  ).bind(params.userId).first();
  if (!target) return err("User not found", 404);

  const suspended = action === "suspend" ? 1 : 0;
  await env.DB.prepare("UPDATE users SET is_suspended=? WHERE id=?").bind(suspended, params.userId).run();

  if (suspended) {
    await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(params.userId).run();
  }

  await env.DB.prepare(
    `INSERT INTO admin_audit_log
     (id, admin_user_id, action, target_type, target_id, details)
     VALUES (?, ?, ?, 'user', ?, ?)`
  ).bind(
    newId(), user.id, suspended ? "user_suspended" : "user_restored",
    params.userId,
    JSON.stringify({ email: target.email, role: target.role })
  ).run();

  return json({ ok: true, isSuspended: Boolean(suspended) });
}
