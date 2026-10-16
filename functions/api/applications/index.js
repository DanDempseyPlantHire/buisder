import { json, err, newId, requireUser, createNotification } from "../../_lib/db.js";
import { recordAnalyticsEvent } from "../../_lib/analytics.js";
import { sendRecruitmentEmail } from "../../_lib/email-notifications.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(context, "jobseeker");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const jobId = body && body.jobId;
  if (!jobId) return err("jobId is required");

  const job = await env.DB.prepare(
    "SELECT id, employer_id, title, company FROM jobs WHERE id = ? AND status = 'active'"
  ).bind(jobId).first();
  if (!job) return err("Job not found", 404);

  const blocked = await env.DB.prepare(
    `SELECT id FROM user_blocks
     WHERE (blocker_user_id=? AND blocked_user_id=?)
        OR (blocker_user_id=? AND blocked_user_id=?)
     LIMIT 1`
  ).bind(user.id, job.employer_id, job.employer_id, user.id).first();

  if (blocked) return err("This application cannot be submitted because one of the accounts is blocked.", 403);

  const id = newId();
  const insert = await env.DB.prepare(
    "INSERT OR IGNORE INTO applications (id, job_id, jobseeker_id, updated_at) VALUES (?, ?, ?, datetime(\'now\'))"
  ).bind(id, jobId, user.id).run();

  if (insert.meta?.changes) {
    await env.DB.prepare(
      `INSERT INTO application_status_history
       (id, application_id, status, actor_user_id, note)
       VALUES (?, ?, 'applied', ?, 'Application submitted')`
    ).bind(newId(), id, user.id).run();

    await createNotification(env, {
      userId: job.employer_id,
      type: "new_application",
      title: "New application",
      body: `${user.name || "A candidate"} applied for ${job.title}.`,
      applicationId: id,
      jobId,
      eventKey: `application:${id}:created`
    });

    await sendRecruitmentEmail(env, request, {
      userId:job.employer_id,
      category:"application",
      eventType:"new_application",
      eventKey:`email:application:${id}:created`,
      subject:`New application: ${job.title}`,
      heading:"You have a new application",
      body:`${user.name || "A candidate"} applied for ${job.title}.`,
      applicationId:id,
      jobId
    });

    await recordAnalyticsEvent(env, {
      userId: user.id,
      userRole: "jobseeker",
      eventType: "application_submitted",
      jobId,
      applicationId: id,
      eventKey: `application:${id}:submitted`
    });
  }

  await env.DB.prepare("DELETE FROM skips WHERE job_id = ? AND jobseeker_id = ?").bind(jobId, user.id).run();

  return json({ ok: true }, { status: 201 });
}
