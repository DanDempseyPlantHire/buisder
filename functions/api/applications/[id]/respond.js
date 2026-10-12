import { json, err, newId, requireUser, createNotification } from "../../../_lib/db.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const { user, error } = await requireUser(context, "jobseeker");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const response = body && body.response;
  if (!["accepted", "declined"].includes(response)) {
    return err("Response must be accepted or declined");
  }

  const app = await env.DB.prepare(
    `SELECT a.id, a.status, a.jobseeker_id, ii.id AS invite_id,
            j.employer_id, j.id AS job_id, j.title AS job_title
     FROM applications a
     JOIN jobs j ON j.id=a.job_id
     LEFT JOIN interview_invites ii ON ii.application_id = a.id
     WHERE a.id = ?`
  ).bind(params.id).first();

  if (!app) return err("Application not found", 404);
  if (app.jobseeker_id !== user.id) return err("Not your application", 403);
  if (!app.invite_id) return err("No interview invitation found", 404);
  if (app.status !== "interview_invited") {
    return err("This interview invitation is no longer actionable");
  }

  await env.DB.prepare(
    `UPDATE interview_invites
     SET status = ?, seen_at = COALESCE(seen_at, datetime('now')), updated_at = datetime('now')
     WHERE application_id = ?`
  ).bind(response, params.id).run();

  const newStatus = response === "accepted" ? "interview_accepted" : "interview_declined";

  if (response === "accepted") {
    await env.DB.prepare(
      `UPDATE applications
       SET status='interview_accepted',
           interview_accepted_at=datetime('now'),
           interview_declined_at=NULL,
           interview_completed_at=NULL,
           updated_at=datetime('now')
       WHERE id=?`
    ).bind(params.id).run();
  } else {
    await env.DB.prepare(
      `UPDATE applications
       SET status='interview_declined',
           interview_declined_at=datetime('now'),
           interview_accepted_at=NULL,
           interview_completed_at=NULL,
           updated_at=datetime('now')
       WHERE id=?`
    ).bind(params.id).run();
  }

  await env.DB.prepare(
    `INSERT INTO application_status_history
     (id, application_id, status, actor_user_id, note)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(
    newId(),
    params.id,
    newStatus,
    user.id,
    response === "accepted" ? "Interview accepted by candidate" : "Interview declined by candidate"
  ).run();

  await createNotification(env, {
    userId: app.employer_id,
    type: "interview_response",
    title: response === "accepted" ? "Interview accepted" : "Interview declined",
    body: `${user.name || "The candidate"} ${response} the interview for ${app.job_title}.`,
    applicationId: params.id,
    jobId: app.job_id,
    eventKey: `interview-response:${params.id}:${newStatus}`
  });

  return json({ ok: true, status: newStatus });
}
