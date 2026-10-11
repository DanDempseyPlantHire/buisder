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
    `SELECT a.id, a.status, a.shortlisted_at, j.employer_id
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     WHERE a.id = ?`
  ).bind(params.id).first();

  if (!app) return err("Application not found", 404);
  if (app.employer_id !== user.id) return err("Not your job posting", 403);
  if (app.status === "applied") return err("Shortlist the candidate before inviting them to interview");
  if (app.status === "interview_completed") return err("This interview has already been completed");

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
    `UPDATE applications
     SET status='interview_invited',
         interview_invited_at=datetime('now'),
         interview_accepted_at=NULL,
         interview_declined_at=NULL,
         interview_completed_at=NULL,
         updated_at=datetime('now')
     WHERE id=?`
  ).bind(params.id).run();

  if (app.status !== "interview_invited") {
    await env.DB.prepare(
      `INSERT INTO application_status_history
       (id, application_id, status, actor_user_id, note)
       VALUES (?, ?, 'interview_invited', ?, ?)`
    ).bind(
      newId(),
      params.id,
      user.id,
      existing ? "Interview rescheduled and invitation renewed" : "Interview invitation sent"
    ).run();
  } else if (existing) {
    await env.DB.prepare(
      `INSERT INTO application_status_history
       (id, application_id, status, actor_user_id, note)
       VALUES (?, ?, 'interview_invited', ?, 'Interview rescheduled')`
    ).bind(newId(), params.id, user.id).run();
  }

  return json({ ok: true });
}
