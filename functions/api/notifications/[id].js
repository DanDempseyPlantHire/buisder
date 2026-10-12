import { json, err, requireUser } from "../../_lib/db.js";

export async function onRequestPost(context) {
  const { env, params } = context;
  const { user, error } = await requireUser(context);
  if (error) return error;

  const notification = await env.DB.prepare(
    "SELECT id, user_id FROM notifications WHERE id=?"
  ).bind(params.id).first();

  if (!notification) return err("Notification not found", 404);
  if (notification.user_id !== user.id) return err("Not your notification", 403);

  await env.DB.prepare(
    "UPDATE notifications SET read_at=COALESCE(read_at, CURRENT_TIMESTAMP) WHERE id=?"
  ).bind(params.id).run();

  return json({ ok: true });
}
