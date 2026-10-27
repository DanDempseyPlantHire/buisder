import { json, err, requireUser } from "../../../_lib/db.js";

// Permanent deletion is explicitly limited to the owner of a withdrawn or unsuccessful application.
export async function onRequestDelete(context) {
  const { env, params } = context;
  const { user, error } = await requireUser(context, "jobseeker");
  if (error) return error;
  const id = String(params.id || "");
  if (!id) return err("Application ID is required", 400);
  const record = await env.DB.prepare(
    "SELECT id, status FROM applications WHERE id = ? AND jobseeker_id = ?"
  ).bind(id, user.id).first();
  if (!record) return err("Application not found", 404);
  if (!["withdrawn", "unsuccessful"].includes(record.status)) {
    return err("Only cancelled or unsuccessful applications can be permanently deleted", 409);
  }
  // D1 enforces the schema's ON DELETE CASCADE relationships for dependent
  // messages, reports, interview invitations, offers, and status history.
  await env.DB.prepare(
    "DELETE FROM applications WHERE id = ? AND jobseeker_id = ? AND status IN ('withdrawn', 'unsuccessful')"
  ).bind(id, user.id).run();
  return json({ ok: true, deleted: true });
}
