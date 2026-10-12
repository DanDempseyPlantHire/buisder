import { json, err, newId, requireUser, createNotification } from "../../../_lib/db.js";

async function addHistory(env, applicationId, status, actorUserId, note = null) {
  await env.DB.prepare(
    `INSERT INTO application_status_history
     (id, application_id, status, actor_user_id, note)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(newId(), applicationId, status, actorUserId, note).run();
}

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const { user, error } = await requireUser(context, "employer");
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return err("Invalid request body");

  const roleTitle = String(body.roleTitle || "").trim();
  const pay = String(body.pay || "").trim();
  const startDate = String(body.startDate || "").trim();
  const message = String(body.message || "").trim();

  if (!roleTitle) return err("Role title is required");
  if (!pay) return err("Pay is required");
  if (!startDate) return err("Start date is required");

  const app = await env.DB.prepare(
    `SELECT a.id, a.status, a.jobseeker_id,
            j.id AS job_id, j.employer_id, j.title AS job_title, j.company
     FROM applications a
     JOIN jobs j ON j.id=a.job_id
     WHERE a.id=?`
  ).bind(params.id).first();

  if (!app) return err("Application not found", 404);
  if (app.employer_id !== user.id) return err("Not your job posting", 403);

  if (!["interview_completed", "offer_made", "offer_declined"].includes(app.status)) {
    return err("Complete the interview before making an offer");
  }

  const existing = await env.DB.prepare(
    "SELECT id, status FROM job_offers WHERE application_id=?"
  ).bind(params.id).first();

  if (existing?.status === "accepted") {
    return err("This offer has already been accepted");
  }

  if (existing) {
    await env.DB.prepare(
      `UPDATE job_offers
       SET role_title=?, pay=?, start_date=?, message=?,
           status='pending', responded_at=NULL, updated_at=CURRENT_TIMESTAMP
       WHERE application_id=?`
    ).bind(roleTitle, pay, startDate, message, params.id).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO job_offers
       (id, application_id, employer_id, jobseeker_id, role_title, pay, start_date, message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      newId(), params.id, user.id, app.jobseeker_id,
      roleTitle, pay, startDate, message
    ).run();
  }

  await env.DB.prepare(
    `UPDATE applications
     SET status='offer_made', updated_at=datetime('now')
     WHERE id=?`
  ).bind(params.id).run();

  await addHistory(
    env,
    params.id,
    "offer_made",
    user.id,
    existing ? "Offer updated and sent to candidate" : "Offer sent to candidate"
  );

  await createNotification(env, {
    userId: app.jobseeker_id,
    type: existing ? "offer_updated" : "offer_made",
    title: existing ? "Job offer updated" : "You have a job offer",
    body: `${app.company || "An employer"} sent you an offer for ${roleTitle}: ${pay}, starting ${startDate}.`,
    applicationId: params.id,
    jobId: app.job_id
  });

  return json({ ok: true, status: "offer_made" });
}

export async function onRequestPatch(context) {
  const { request, env, params } = context;
  const { user, error } = await requireUser(context, "jobseeker");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const response = String(body?.response || "").toLowerCase();

  if (!["accepted", "declined"].includes(response)) {
    return err("Response must be accepted or declined");
  }

  const offer = await env.DB.prepare(
    `SELECT o.id, o.status, o.jobseeker_id, o.role_title,
            a.id AS application_id, a.status AS application_status,
            j.id AS job_id, j.employer_id, j.title AS job_title
     FROM job_offers o
     JOIN applications a ON a.id=o.application_id
     JOIN jobs j ON j.id=a.job_id
     WHERE o.application_id=?`
  ).bind(params.id).first();

  if (!offer) return err("Offer not found", 404);
  if (offer.jobseeker_id !== user.id) return err("This offer is not yours", 403);
  if (offer.status !== "pending" || offer.application_status !== "offer_made") {
    return err("This offer has already been answered");
  }

  await env.DB.prepare(
    `UPDATE job_offers
     SET status=?, responded_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
     WHERE application_id=?`
  ).bind(response, params.id).run();

  const applicationStatus = response === "accepted" ? "offer_accepted" : "offer_declined";

  await env.DB.prepare(
    `UPDATE applications
     SET status=?, updated_at=datetime('now')
     WHERE id=?`
  ).bind(applicationStatus, params.id).run();

  await addHistory(
    env,
    params.id,
    applicationStatus,
    user.id,
    response === "accepted" ? "Offer accepted by candidate" : "Offer declined by candidate"
  );

  await createNotification(env, {
    userId: offer.employer_id,
    type: "offer_response",
    title: response === "accepted" ? "Offer accepted" : "Offer declined",
    body: `${user.name || "The candidate"} ${response} the offer for ${offer.job_title}.`,
    applicationId: params.id,
    jobId: offer.job_id,
    eventKey: `offer-response:${params.id}:${applicationStatus}`
  });

  return json({ ok: true, status: applicationStatus });
}
