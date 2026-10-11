import { json, err, newId, requireAdmin } from "../../../_lib/db.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const { user, error } = await requireAdmin(context);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return err("Invalid request body");

  const action = String(body.action || "").toLowerCase();
  if (!["close", "reopen"].includes(action)) return err("Action must be close or reopen");

  const target = await env.DB.prepare(
    "SELECT id, title, company, employer_id, status FROM jobs WHERE id=?"
  ).bind(params.jobId).first();
  if (!target) return err("Job not found", 404);

  const status = action === "close" ? "closed" : "active";
  await env.DB.prepare("UPDATE jobs SET status=? WHERE id=?").bind(status, params.jobId).run();

  await env.DB.prepare(
    `INSERT INTO admin_audit_log
     (id, admin_user_id, action, target_type, target_id, details)
     VALUES (?, ?, ?, 'job', ?, ?)`
  ).bind(
    newId(), user.id, action === "close" ? "job_closed" : "job_reopened",
    params.jobId,
    JSON.stringify({ title: target.title, company: target.company, employerId: target.employer_id })
  ).run();

  return json({ ok: true, status });
}
