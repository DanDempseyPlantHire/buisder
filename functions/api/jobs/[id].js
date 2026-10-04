import { json, err, requireUser } from "../../_lib/db.js";

export async function onRequestDelete(context) {
  const { env, params } = context;
  const { user, error } = await requireUser(context, "employer");
  if (error) return error;

  const job = await env.DB.prepare("SELECT employer_id FROM jobs WHERE id = ?").bind(params.id).first();
  if (!job) return err("Job not found", 404);
  if (job.employer_id !== user.id) return err("Not your job posting", 403);

  await env.DB.prepare("UPDATE jobs SET status = 'closed' WHERE id = ?").bind(params.id).run();
  return json({ ok: true });
}
