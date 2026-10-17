import { json, err, newId, requireAdmin } from "../../../_lib/db.js";

const STATUSES = new Set(["planned","active","paused","completed"]);

export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, error } = await requireAdmin(context);
  if (error) return error;
  const body = await request.json().catch(() => null);
  if (!body) return err("Invalid request body");

  const pilotName = String(body.pilotName || "Buisder Pilot").trim().slice(0,120) || "Buisder Pilot";
  const status = String(body.status || "active");
  if (!STATUSES.has(status)) return err("Invalid pilot status");

  const inviteRequired = body.inviteRequired ? 1 : 0;
  const feedbackEnabled = body.feedbackEnabled ? 1 : 0;

  await env.DB.prepare(
    `INSERT INTO pilot_settings
     (id,pilot_name,invite_required,feedback_enabled,status,updated_by,updated_at)
     VALUES ('default',?,?,?,?,?,CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       pilot_name=excluded.pilot_name,
       invite_required=excluded.invite_required,
       feedback_enabled=excluded.feedback_enabled,
       status=excluded.status,
       updated_by=excluded.updated_by,
       updated_at=CURRENT_TIMESTAMP`
  ).bind(pilotName, inviteRequired, feedbackEnabled, status, user.id).run();

  await env.DB.prepare(
    `INSERT INTO admin_audit_log
     (id,admin_user_id,action,target_type,target_id,details)
     VALUES (?,?,'pilot_settings_updated','pilot','default',?)`
  ).bind(newId(), user.id, JSON.stringify({ pilotName, inviteRequired:Boolean(inviteRequired), feedbackEnabled:Boolean(feedbackEnabled), status })).run();

  return json({ ok:true });
}
