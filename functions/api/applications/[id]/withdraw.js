import { json, err, newId, requireUser, createNotification } from "../../../_lib/db.js";

export async function onRequestPost(context) {
  const { env, params } = context;
  const { user, error } = await requireUser(context, "jobseeker");
  if (error) return error;

  const app = await env.DB.prepare(
    `SELECT a.id, a.status, a.jobseeker_id,
            j.id AS job_id, j.employer_id, j.title AS job_title
     FROM applications a
     JOIN jobs j ON j.id=a.job_id
     WHERE a.id=?`
  ).bind(params.id).first();

  if (!app) return err("Application not found", 404);
  if (app.jobseeker_id !== user.id) return err("Not your application", 403);

  if (["hired", "unsuccessful", "withdrawn"].includes(app.status)) {
    return err("This application is already closed");
  }

  await env.DB.prepare(
    `UPDATE applications
     SET status='withdrawn',
         updated_at=datetime('now')
     WHERE id=?`
  ).bind(params.id).run();

  // Prevent any outstanding invitation or offer from remaining actionable.
  await env.DB.prepare(
    `UPDATE interview_invites
     SET status='declined',
         seen_at=COALESCE(seen_at, datetime('now')),
         updated_at=datetime('now')
     WHERE application_id=? AND status='pending'`
  ).bind(params.id).run();

  await env.DB.prepare(
    `UPDATE job_offers
     SET status='declined',
         responded_at=COALESCE(responded_at, CURRENT_TIMESTAMP),
         updated_at=CURRENT_TIMESTAMP
     WHERE application_id=? AND status='pending'`
  ).bind(params.id).run();

  await env.DB.prepare(
    `INSERT INTO application_status_history
     (id, application_id, status, actor_user_id, note)
     VALUES (?, ?, 'withdrawn', ?, 'Application withdrawn by candidate')`
  ).bind(newId(), params.id, user.id).run();

  await createNotification(env, {
    userId: app.employer_id,
    type: "application_withdrawn",
    title: "Application withdrawn",
    body: `${user.name || "A candidate"} withdrew their application for ${app.job_title}.`,
    applicationId: params.id,
    jobId: app.job_id,
    eventKey: `application:${params.id}:withdrawn`
  });

  return json({ ok: true, status: "withdrawn" });
}
