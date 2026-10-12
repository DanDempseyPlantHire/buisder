import { json, requireUser } from "../../_lib/db.js";

export async function onRequestPost(context) {
  const { env } = context;
  const { user, error } = await requireUser(context);
  if (error) return error;

  await env.DB.prepare(
    "UPDATE notifications SET read_at=COALESCE(read_at, CURRENT_TIMESTAMP) WHERE user_id=?"
  ).bind(user.id).run();

  return json({ ok: true });
}
