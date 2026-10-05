import { json, err, requireUser } from "../../../_lib/db.js";

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
    `SELECT a.id, a.jobseeker_id, ii.id AS invite_id
     FROM applications a
     LEFT JOIN interview_invites ii ON ii.application_id = a.id
     WHERE a.id = ?`
  ).bind(params.id).first();

  if (!app) return err("Application not found", 404);
  if (app.jobseeker_id !== user.id) return err("Not your application", 403);
  if (!app.invite_id) return err("No interview invitation found", 404);

  await env.DB.prepare(
    `UPDATE interview_invites
     SET status = ?, seen_at = COALESCE(seen_at, datetime('now')), updated_at = datetime('now')
     WHERE application_id = ?`
  ).bind(response, params.id).run();

  await env.DB.prepare(
    "UPDATE applications SET status = ? WHERE id = ?"
  ).bind(response === "accepted" ? "interview_accepted" : "interview_declined", params.id).run();

  return json({ ok: true });
}
