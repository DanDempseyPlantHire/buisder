import { json, err, requireUser } from "../../_lib/db.js";

export async function onRequestDelete(context) {
  const { env, params } = context;
  const { user, error } = await requireUser(context);
  if (error) return error;

  const result = await env.DB.prepare(
    "DELETE FROM user_blocks WHERE blocker_user_id=? AND blocked_user_id=?"
  ).bind(user.id, params.userId).run();

  if (!result.meta?.changes) return err("Block not found", 404);
  return json({ ok: true });
}
