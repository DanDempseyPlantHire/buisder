import { json, err, requireUser } from "../../_lib/db.js";
import { recordAnalyticsEvent, utcDay } from "../../_lib/analytics.js";

const ALLOWED = new Set(["app_open", "job_view"]);

export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(context);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return err("Invalid request body");

  const eventType = String(body.eventType || "");
  if (!ALLOWED.has(eventType)) return err("Unsupported analytics event");

  let jobId = null;
  if (eventType === "job_view") {
    jobId = String(body.jobId || "");
    if (!jobId) return err("jobId is required");

    const job = await env.DB.prepare(
      "SELECT id FROM jobs WHERE id=?"
    ).bind(jobId).first();
    if (!job) return err("Job not found", 404);
  }

  const day = utcDay();
  const eventKey = eventType === "app_open"
    ? `app_open:${user.id}:${day}`
    : `job_view:${user.id}:${jobId}:${day}`;

  await recordAnalyticsEvent(env, {
    userId: user.id,
    userRole: user.role,
    eventType,
    jobId,
    eventKey
  });

  return json({ ok: true });
}
