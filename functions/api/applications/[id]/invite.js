import { json, err, newId, requireUser } from "../../../_lib/db.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const { user, error } = await requireUser(context, "employer");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const interviewAt = body && typeof body.interviewAt === "string" ? body.interviewAt.trim() : "";
  const interviewLocation = body && typeof body.interviewLocation === "string" ? body.interviewLocation.trim() : "";
  const interviewMessage = body && typeof body.interviewMessage === "string" ? body.interviewMessage.trim() : "";

  if (!interviewAt) return err("Interview date and time are required");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(interviewAt)) {
    return err("Interview date and time are invalid");
  }

  const app = await env.DB.prepare(
    `SELECT a.id, j.employer_id
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     WHERE a.id = ?`
  ).bind(params.id).first();

  if (!app) return err("Application not found", 404);
  if (app.employer_id !== user.id) return err("Not your job posting", 403);

  const existing = await env.DB.prepare(
    "SELECT id FROM interview_invites WHERE application_id = ?"
  ).bind(params.id).first();

  if (existing) {
    await env.DB.prepare(
      `UPDATE interview_invites
       SET interview_at = ?, location = ?, message = ?, status = 'pending',
           seen_at = NULL, updated_at = datetime('now')
       WHERE application_id = ?`
    ).bind(interviewAt, interviewLocation || null, interviewMessage || null, params.id).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO interview_invites
       (id, application_id, interview_at, location, message, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`
    ).bind(newId(), params.id, interviewAt, interviewLocation || null, interviewMessage || null).run();
  }

  await env.DB.prepare(
    "UPDATE applications SET status = 'invited' WHERE id = ?"
  ).bind(params.id).run();

  return json({ ok: true });
}
