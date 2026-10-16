import { json, err, newId, requireUser, createNotification } from "../../../_lib/db.js";
import { sendRecruitmentEmail } from "../../../_lib/email-notifications.js";

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
    `SELECT a.id, a.status, a.shortlisted_at, a.jobseeker_id,
            j.employer_id, j.id AS job_id, j.title AS job_title, j.company
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     WHERE a.id = ?`
  ).bind(params.id).first();

  if (!app) return err("Application not found", 404);
  if (app.employer_id !== user.id) return err("Not your job posting", 403);

  if (app.status === "applied") {
    return err("Shortlist the candidate before inviting them to interview");
  }

  const interviewStages = new Set([
    "shortlisted",
    "interview_invited",
    "interview_accepted",
    "interview_declined"
  ]);

  if (!interviewStages.has(app.status)) {
    return err("This application can no longer be moved into the interview stage");
  }

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

  await createNotification(env, {
    userId: app.jobseeker_id,
    type: existing ? "interview_updated" : "interview_invitation",
    title: existing ? "Interview updated" : "Interview invitation",
    body: `${app.company || "An employer"} ${existing ? "updated" : "invited you to"} an interview for ${app.job_title} on ${interviewAt.replace("T", " ")}${interviewLocation ? " · " + interviewLocation : ""}.`,
    applicationId: params.id,
    jobId: app.job_id,
    eventKey: `interview:${params.id}:${interviewAt}:${interviewLocation || ""}`
  });

  await sendRecruitmentEmail(env, request, {
    userId:app.jobseeker_id, category:"interview",
    eventType:existing ? "interview_updated" : "interview_invitation",
    eventKey:`email:interview:${params.id}:${interviewAt}:${interviewLocation || ""}`,
    subject:`${existing ? "Interview updated" : "Interview invitation"}: ${app.job_title}`,
    heading:existing ? "Your interview was updated" : "Interview invitation",
    body:`${app.company || "An employer"} ${existing ? "updated your interview" : "invited you to an interview"} for ${app.job_title}.`,
    applicationId:params.id, jobId:app.job_id,
    detailLines:[`When: ${interviewAt.replace("T", " ")}`, interviewLocation ? `Where: ${interviewLocation}` : null, interviewMessage ? `Message: ${interviewMessage}` : null]
  });

  return json({ ok: true });
}
