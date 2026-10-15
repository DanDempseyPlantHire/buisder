import { newId } from "./db.js";

export async function recordAnalyticsEvent(env, {
  userId = null,
  userRole = null,
  eventType,
  jobId = null,
  applicationId = null,
  eventKey = null,
  metadata = null,
  createdAt = null
}) {
  if (!eventType) return false;

  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO analytics_events
       (id, user_id, user_role, event_type, job_id, application_id,
        event_key, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`
    ).bind(
      newId(),
      userId,
      userRole,
      eventType,
      jobId,
      applicationId,
      eventKey,
      metadata ? JSON.stringify(metadata) : null,
      createdAt
    ).run();
    return true;
  } catch {
    // Analytics must never break the recruitment workflow if the migration
    // has not yet been deployed or analytics storage is temporarily unavailable.
    return false;
  }
}

export function utcDay() {
  return new Date().toISOString().slice(0, 10);
}
