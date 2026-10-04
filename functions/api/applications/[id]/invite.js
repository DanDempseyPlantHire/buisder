import { json, err, requireUser } from "../../../_lib/db.js";

export async function onRequestPost(context) {
  const { env, params } = context;
  const { user, error } = await requireUser(context, "employer");
  if (error) return error;

  const app = await env.DB.prepare(
    `SELECT a.id, j.employer_id FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ?`
  ).bind(params.id).first();
  if (!app) return err("Application not found", 404);
  if (app.employer_id !== user.id) return err("Not your job posting", 403);

  await env.DB.prepare("UPDATE applications SET status = 'invited' WHERE id = ?").bind(params.id).run();
  return json({ ok: true });
}
