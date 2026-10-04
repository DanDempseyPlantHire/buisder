import { json, requireUser } from "../_lib/db.js";

export async function onRequestPost(context) {
  const { env } = context;
  const { user, error } = await requireUser(context, "jobseeker");
  if (error) return error;

  await env.DB.prepare("DELETE FROM applications WHERE jobseeker_id = ?").bind(user.id).run();
  await env.DB.prepare("DELETE FROM skips WHERE jobseeker_id = ?").bind(user.id).run();

  return json({ ok: true });
}
