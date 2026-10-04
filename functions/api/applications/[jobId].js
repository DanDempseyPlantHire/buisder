import { json, requireUser } from "../../_lib/db.js";

export async function onRequestDelete(context) {
  const { env, params } = context;
  const { user, error } = await requireUser(context, "jobseeker");
  if (error) return error;

  await env.DB.prepare("DELETE FROM applications WHERE job_id = ? AND jobseeker_id = ?")
    .bind(params.jobId, user.id).run();
  return json({ ok: true });
}
