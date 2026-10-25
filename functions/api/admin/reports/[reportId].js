import {
  json, err, newId, requireAdmin, createNotification
} from "../../../_lib/db.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const { user, error } = await requireAdmin(context);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return err("Invalid request body");

  const action = String(body.action || "");
  const note = String(body.note || "").trim().slice(0, 2000);

  if (!["review","resolve","dismiss","suspend_target","close_job"].includes(action)) {
    return err("Invalid moderation action");
  }

  const report = await env.DB.prepare(
    `SELECT id, reporter_user_id, target_type, target_user_id,
            job_id, status
     FROM safety_reports WHERE id=?`
  ).bind(params.reportId).first();

  if (!report) return err("Report not found", 404);

  let status = report.status;
  let auditAction = "report_reviewed";

  if (action === "review") status = "reviewing";
  if (action === "resolve") { status = "resolved"; auditAction = "report_resolved"; }
  if (action === "dismiss") { status = "dismissed"; auditAction = "report_dismissed"; }

  if (action === "suspend_target") {
    if (!report.target_user_id) return err("This report has no user target");
    if (report.target_user_id === user.id) return err("You cannot suspend your own admin account");

    await env.DB.prepare(
      "UPDATE users SET is_suspended=1 WHERE id=?"
    ).bind(report.target_user_id).run();
    await env.DB.prepare(
      "DELETE FROM sessions WHERE user_id=?"
    ).bind(report.target_user_id).run();

    status = "resolved";
    auditAction = "reported_user_suspended";
  }

  if (action === "close_job") {
    if (!report.job_id) return err("This report has no job target");

    await env.DB.prepare(
      "UPDATE jobs SET status='closed' WHERE id=?"
    ).bind(report.job_id).run();

    status = "resolved";
    auditAction = "reported_job_closed";
  }

  await env.DB.prepare(
    `UPDATE safety_reports
     SET status=?, admin_note=?, reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP,
         updated_at=CURRENT_TIMESTAMP
     WHERE id=?`
  ).bind(status, note, user.id, report.id).run();

  await env.DB.prepare(
    `INSERT INTO admin_audit_log
     (id, admin_user_id, action, target_type, target_id, details)
     VALUES (?, ?, ?, 'safety_report', ?, ?)`
  ).bind(
    newId(), user.id, auditAction, report.id,
    JSON.stringify({
      targetType: report.target_type,
      targetUserId: report.target_user_id,
      jobId: report.job_id,
      note
    })
  ).run();

  if (report.reporter_user_id && ["resolved","dismissed"].includes(status)) {
    await createNotification(env, {
      userId: report.reporter_user_id,
      type: "safety_report_update",
      title: "Safety report reviewed",
      body: status === "resolved"
        ? "Deas Jobs has reviewed your report and taken the appropriate action."
        : "Deas Jobs has reviewed and closed your report.",
      eventKey: `safety-report-update:${report.id}:${status}`
    });
  }

  return json({ ok: true, status });
}
