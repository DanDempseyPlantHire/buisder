import {
  json, err, newId, requireUser, createNotification
} from "../../_lib/db.js";

const REASONS = new Set([
  "scam_fraud","misleading","inappropriate","harassment",
  "discrimination","unsafe","other"
]);

export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(context);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return err("Invalid request body");

  const targetType = String(body.targetType || "");
  const targetId = String(body.targetId || "");
  const reason = String(body.reason || "");
  const details = String(body.details || "").trim().slice(0, 2000);

  if (!["job","employer","applicant"].includes(targetType)) return err("Invalid report target");
  if (!REASONS.has(reason)) return err("Choose a report reason");
  if (!targetId) return err("Report target is required");

  let targetUserId = null;
  let jobId = null;
  let applicationId = null;

  if (targetType === "job") {
    const job = await env.DB.prepare(
      "SELECT id, employer_id FROM jobs WHERE id=?"
    ).bind(targetId).first();
    if (!job) return err("Job not found", 404);
    targetUserId = job.employer_id;
    jobId = job.id;
  }

  if (targetType === "employer") {
    const employer = await env.DB.prepare(
      "SELECT id FROM users WHERE id=? AND role='employer'"
    ).bind(targetId).first();
    if (!employer) return err("Employer not found", 404);
    targetUserId = employer.id;
    if (body.jobId) {
      const job = await env.DB.prepare(
        "SELECT id FROM jobs WHERE id=? AND employer_id=?"
      ).bind(String(body.jobId), employer.id).first();
      if (job) jobId = job.id;
    }
  }

  if (targetType === "applicant") {
    if (user.role !== "employer") return err("Only employers can report applicants", 403);

    const application = await env.DB.prepare(
      `SELECT a.id, a.jobseeker_id, a.job_id
       FROM applications a
       JOIN jobs j ON j.id=a.job_id
       WHERE a.id=? AND a.jobseeker_id=? AND j.employer_id=?`
    ).bind(String(body.applicationId || ""), targetId, user.id).first();

    if (!application) return err("Applicant relationship not found", 404);
    targetUserId = application.jobseeker_id;
    jobId = application.job_id;
    applicationId = application.id;
  }

  if (targetUserId === user.id) return err("You cannot report your own account");

  const duplicate = await env.DB.prepare(
    `SELECT id FROM safety_reports
     WHERE reporter_user_id=?
       AND target_type=?
       AND COALESCE(target_user_id,'')=COALESCE(?, '')
       AND COALESCE(job_id,'')=COALESCE(?, '')
       AND status IN ('open','reviewing')
     LIMIT 1`
  ).bind(user.id, targetType, targetUserId, jobId).first();

  if (duplicate) return err("You already have an open report for this item.", 409);

  const id = newId();
  await env.DB.prepare(
    `INSERT INTO safety_reports
     (id, reporter_user_id, target_type, target_user_id, job_id, application_id, reason, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, user.id, targetType, targetUserId, jobId, applicationId, reason, details
  ).run();

  const { results: admins } = await env.DB.prepare(
    "SELECT user_id AS userId FROM admin_users"
  ).all();

  for (const admin of admins || []) {
    await createNotification(env, {
      userId: admin.userId,
      type: "safety_report",
      title: "New safety report",
      body: `A ${targetType} report is waiting for review.`,
      eventKey: `safety-report:${id}:${admin.userId}`
    });
  }

  return json({ ok: true, id }, { status: 201 });
}
