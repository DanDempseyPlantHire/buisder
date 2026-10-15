import { json, err, requireUser } from "../../_lib/db.js";
import { recordAnalyticsEvent } from "../../_lib/analytics.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(context, "jobseeker");
  if (error) return error;

  const body = await request.json().catch(() => null);
  const jobId = body && body.jobId;
  if (!jobId) return err("jobId is required");

  await env.DB.prepare("INSERT OR IGNORE INTO skips (jobseeker_id, job_id) VALUES (?, ?)")
    .bind(user.id, jobId).run();

  await recordAnalyticsEvent(env, {
    userId: user.id,
    userRole: "jobseeker",
    eventType: "job_skip",
    jobId,
    eventKey: `job_skip:${user.id}:${jobId}`
  });

  return json({ ok: true }, { status: 201 });
}
