import { json, err, requireUser } from "../../_lib/db.js";

function flag(value) {
  return value === true || value === 1 || value === "1";
}

export async function onRequestGet(context) {
  const { env } = context;
  const { user, error } = await requireUser(context);
  if (error) return error;

  const row = await env.DB.prepare(
    `SELECT recruitment_emails AS recruitmentEmails,
            application_updates AS applicationUpdates,
            interviews,
            interview_reminders AS interviewReminders,
            offers,
            outcomes,
            updated_at AS updatedAt
     FROM notification_preferences WHERE user_id=?`
  ).bind(user.id).first();

  return json({
    preferences: row || {
      recruitmentEmails:1,
      applicationUpdates:1,
      interviews:1,
      interviewReminders:1,
      offers:1,
      outcomes:1,
      updatedAt:null
    }
  }, { headers:{ "Cache-Control":"no-store" } });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(context);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return err("Invalid request body");

  const values = {
    recruitmentEmails:flag(body.recruitmentEmails),
    applicationUpdates:flag(body.applicationUpdates),
    interviews:flag(body.interviews),
    interviewReminders:flag(body.interviewReminders),
    offers:flag(body.offers),
    outcomes:flag(body.outcomes)
  };

  await env.DB.prepare(
    `INSERT INTO notification_preferences
     (user_id, recruitment_emails, application_updates, interviews,
      interview_reminders, offers, outcomes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       recruitment_emails=excluded.recruitment_emails,
       application_updates=excluded.application_updates,
       interviews=excluded.interviews,
       interview_reminders=excluded.interview_reminders,
       offers=excluded.offers,
       outcomes=excluded.outcomes,
       updated_at=CURRENT_TIMESTAMP`
  ).bind(
    user.id,
    values.recruitmentEmails ? 1 : 0,
    values.applicationUpdates ? 1 : 0,
    values.interviews ? 1 : 0,
    values.interviewReminders ? 1 : 0,
    values.offers ? 1 : 0,
    values.outcomes ? 1 : 0
  ).run();

  return json({ ok:true, preferences:values });
}
