import { json, err, newId, requireUser } from "../../../_lib/db.js";

const ALLOWED = new Set([
  "shortlist",
  "remove_shortlist",
  "interview_completed",
  "mark_hired"
]);

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
  const action = String(body?.action || "");
  if (!ALLOWED.has(action)) return err("Unsupported application action");

  const app = await env.DB.prepare(
    `SELECT a.id, a.status, a.shortlisted_at, a.interview_completed_at,
            j.employer_id,
            ii.status AS interview_status,
            o.status AS offer_status
     FROM applications a
     JOIN jobs j ON j.id=a.job_id
     LEFT JOIN interview_invites ii ON ii.application_id=a.id
     LEFT JOIN job_offers o ON o.application_id=a.id
     WHERE a.id=?`
  ).bind(params.id).first();

  if (!app) return err("Application not found", 404);
  if (app.employer_id !== user.id) return err("Not your job posting", 403);

  if (action === "shortlist") {
    if (!["applied", "shortlisted"].includes(app.status)) {
      return err("This application has already moved beyond shortlisting");
    }

    await env.DB.prepare(
      `UPDATE applications
       SET status='shortlisted',
           shortlisted_at=COALESCE(shortlisted_at, datetime('now')),
           updated_at=datetime('now')
       WHERE id=?`
    ).bind(params.id).run();

    if (app.status !== "shortlisted") {
      await addHistory(env, params.id, "shortlisted", user.id, "Candidate shortlisted by employer");
    }

    return json({ ok: true, status: "shortlisted" });
  }

  if (action === "remove_shortlist") {
    if (app.status !== "shortlisted") {
      return err("Only a shortlisted application can be moved back to Applied");
    }

    await env.DB.prepare(
      `UPDATE applications
       SET status='applied',
           shortlisted_at=NULL,
           updated_at=datetime('now')
       WHERE id=?`
    ).bind(params.id).run();

    await addHistory(env, params.id, "applied", user.id, "Candidate removed from shortlist");
    return json({ ok: true, status: "applied" });
  }

  if (action === "interview_completed") {
    if (app.status !== "interview_accepted" || app.interview_status !== "accepted") {
      return err("The candidate must accept the interview before it can be marked completed");
    }

    await env.DB.prepare(
      `UPDATE applications
       SET status='interview_completed',
           interview_completed_at=datetime('now'),
           updated_at=datetime('now')
       WHERE id=?`
    ).bind(params.id).run();

    await addHistory(env, params.id, "interview_completed", user.id, "Interview marked completed by employer");
    return json({ ok: true, status: "interview_completed" });
  }


  if (action === "mark_hired") {
    if (app.status !== "offer_accepted" || app.offer_status !== "accepted") {
      return err("The candidate must accept the offer before they can be marked Hired");
    }

    await env.DB.prepare(
      `UPDATE applications
       SET status='hired',
           updated_at=datetime('now')
       WHERE id=?`
    ).bind(params.id).run();

    await addHistory(env, params.id, "hired", user.id, "Candidate marked hired by employer");
    return json({ ok: true, status: "hired" });
  }

  return err("Unsupported application action");
}
