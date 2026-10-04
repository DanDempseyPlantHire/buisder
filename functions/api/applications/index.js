import { json, err, newId, requireUser } from "../../_lib/db.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(context, "jobseeker");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const jobId = body && body.jobId;
  if (!jobId) return err("jobId is required");

  const job = await env.DB.prepare("SELECT id FROM jobs WHERE id = ? AND status = 'active'").bind(jobId).first();
  if (!job) return err("Job not found", 404);

  const id = newId();
  await env.DB.prepare(
    "INSERT OR IGNORE INTO applications (id, job_id, jobseeker_id) VALUES (?, ?, ?)"
  ).bind(id, jobId, user.id).run();
  await env.DB.prepare("DELETE FROM skips WHERE job_id = ? AND jobseeker_id = ?").bind(jobId, user.id).run();

  return json({ ok: true }, { status: 201 });
}
