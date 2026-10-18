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


export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const { user, error } = await requireAdmin(context);
  if (error) return error;

  if (params.userId === user.id) return err("You cannot delete your own admin account", 400);
  const body = await request.json().catch(() => null);
  if (String(body?.confirm || "") !== "DELETE") return err("Type DELETE to confirm permanent deletion");

  const target = await env.DB.prepare(
    `SELECT u.id,u.email,u.name,u.role,
            CASE WHEN au.user_id IS NULL THEN 0 ELSE 1 END AS isAdmin
     FROM users u LEFT JOIN admin_users au ON au.user_id=u.id
     WHERE u.id=?`
  ).bind(params.userId).first();
  if (!target) return err("User not found", 404);
  if (target.isAdmin) return err("Admin accounts cannot be permanently deleted here", 403);

  const keys = [];
  if (target.role === "jobseeker") {
    const p = await env.DB.prepare(
      "SELECT photo_key,cv_key FROM jobseeker_profiles WHERE user_id=?"
    ).bind(target.id).first();
    if (p?.photo_key) keys.push(p.photo_key);
    if (p?.cv_key) keys.push(p.cv_key);
  } else {
    const p = await env.DB.prepare(
      "SELECT logo_key FROM employer_profiles WHERE user_id=?"
    ).bind(target.id).first();
    if (p?.logo_key) keys.push(p.logo_key);
  }

  if (keys.length && env.FILES) {
    try {
      for (const key of keys) await env.FILES.delete(key);
    } catch {
      return err("Stored files could not be deleted. The account was not deleted.", 500);
    }
  }

  // Write the audit event before deletion. target_id is plain text, so the
  // audit record remains even after the target user row is removed.
  await env.DB.prepare(
    `INSERT INTO admin_audit_log
     (id,admin_user_id,action,target_type,target_id,details)
     VALUES (?,?,'user_permanently_deleted','user',?,?)`
  ).bind(newId(), user.id, target.id, JSON.stringify({ email: target.email, role: target.role })).run();

  await env.DB.prepare("DELETE FROM users WHERE id=?").bind(target.id).run();
  return json({ ok: true });
}
