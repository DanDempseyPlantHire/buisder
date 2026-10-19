import { newId } from "./db.js";
import { appOrigin, sendEmail } from "./security.js";

const CATEGORY_COLUMN = {
  application: "application_updates",
  interview: "interviews",
  interview_reminder: "interview_reminders",
  offer: "offers",
  outcome: "outcomes"
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function preferenceEnabled(row, category) {
  if (!row) return true;
  if (!Number(row.recruitment_emails)) return false;
  const column = CATEGORY_COLUMN[category];
  return column ? Boolean(Number(row[column])) : true;
}

async function writeLog(env, {
  id,
  userId,
  eventType,
  eventKey,
  applicationId,
  jobId,
  status,
  attemptCount,
  providerMessageId = null,
  lastError = null,
  sent = false
}) {
  await env.DB.prepare(
    `INSERT INTO email_delivery_log
     (id, user_id, event_type, event_key, application_id, job_id,
      status, attempt_count, provider_message_id, last_error,
      sent_at, last_attempt_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
             CASE WHEN ?=1 THEN CURRENT_TIMESTAMP ELSE NULL END,
             CURRENT_TIMESTAMP)
     ON CONFLICT(event_key) DO UPDATE SET
       user_id=excluded.user_id,
       status=excluded.status,
       attempt_count=excluded.attempt_count,
       provider_message_id=excluded.provider_message_id,
       last_error=excluded.last_error,
       sent_at=CASE WHEN excluded.status='sent' THEN CURRENT_TIMESTAMP ELSE email_delivery_log.sent_at END,
       last_attempt_at=CURRENT_TIMESTAMP`
  ).bind(
    id, userId, eventType, eventKey, applicationId, jobId,
    status, attemptCount, providerMessageId, lastError,
    sent ? 1 : 0
  ).run();
}

export async function sendRecruitmentEmail(env, request, {
  userId,
  category,
  eventType,
  eventKey,
  subject,
  heading,
  body,
  applicationId = null,
  jobId = null,
  detailLines = []
}) {
  if (!userId || !eventKey) return { ok:false, reason:"missing_target" };

  try {
    const existing = await env.DB.prepare(
      `SELECT id, status, attempt_count AS attemptCount
       FROM email_delivery_log WHERE event_key=?`
    ).bind(eventKey).first();

    if (existing?.status === "sent" || existing?.status === "skipped") {
      return { ok:true, skipped:true, reason:"already_processed" };
    }

    if (Number(existing?.attemptCount || 0) >= 3) {
      return { ok:false, skipped:true, reason:"retry_limit" };
    }

    const user = await env.DB.prepare(
      `SELECT id, email, name, is_suspended AS suspended
       FROM users WHERE id=?`
    ).bind(userId).first();

    if (!user || user.suspended) {
      return { ok:false, skipped:true, reason:"user_unavailable" };
    }

    const prefs = await env.DB.prepare(
      `SELECT recruitment_emails, application_updates, interviews,
              interview_reminders, offers, outcomes
       FROM notification_preferences WHERE user_id=?`
    ).bind(userId).first();

    const logId = existing?.id || newId();
    const nextAttempt = Number(existing?.attemptCount || 0) + 1;

    if (!preferenceEnabled(prefs, category)) {
      await writeLog(env, {
        id:logId, userId, eventType, eventKey, applicationId, jobId,
        status:"skipped", attemptCount:Number(existing?.attemptCount || 0)
      });
      return { ok:true, skipped:true, reason:"preference" };
    }

    const origin = request ? appOrigin(env, request) : String(env.APP_URL || "").trim().replace(/\/+$/g, "");
    const safeName = escapeHtml(user.name || "there");
    const safeHeading = escapeHtml(heading || subject || "DEASJobs update");
    const safeBody = escapeHtml(body || "");
    const detailsHtml = (detailLines || [])
      .filter(Boolean)
      .map(line => `<li style="margin:4px 0">${escapeHtml(line)}</li>`)
      .join("");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#182230;line-height:1.5">
        <h2 style="margin-bottom:8px">${safeHeading}</h2>
        <p>Hi ${safeName},</p>
        <p>${safeBody}</p>
        ${detailsHtml ? `<ul style="padding-left:20px">${detailsHtml}</ul>` : ""}
        ${origin ? `<p style="margin-top:24px"><a href="${escapeHtml(origin)}" style="display:inline-block;padding:11px 16px;background:#182230;color:#fff;text-decoration:none;border-radius:8px">Open DEASJobs</a></p>` : ""}
        <p style="font-size:12px;color:#667085;margin-top:28px">You can change recruitment email preferences in DEASJobs under Account &amp; Privacy. Security and account-recovery emails cannot be disabled.</p>
      </div>`;

    const text = [
      heading || subject || "DEASJobs update",
      `Hi ${user.name || "there"},`,
      body || "",
      ...(detailLines || []).filter(Boolean).map(line => `- ${line}`),
      origin ? `Open DEASJobs: ${origin}` : "",
      "You can change recruitment email preferences in Account & Privacy."
    ].filter(Boolean).join("\n\n");

    const sent = await sendEmail(env, {
      to:user.email,
      subject:subject || "DEASJobs update",
      html,
      text
    });

    if (sent.ok) {
      await writeLog(env, {
        id:logId, userId, eventType, eventKey, applicationId, jobId,
        status:"sent", attemptCount:nextAttempt,
        providerMessageId:sent.id || null,
        sent:true
      });
      return { ok:true };
    }

    await writeLog(env, {
      id:logId, userId, eventType, eventKey, applicationId, jobId,
      status:"failed", attemptCount:nextAttempt,
      lastError:sent.configured === false
        ? "Email delivery is not configured"
        : `Email provider failure${sent.status ? ` (${sent.status})` : ""}`
    });

    return { ok:false, reason:"delivery_failed" };
  } catch {
    // Recruitment actions must never fail because email delivery/logging failed.
    return { ok:false, reason:"email_subsystem_error" };
  }
}

export async function maybeSendDueInterviewReminderEmails(env, request) {
  try {
    const state = await env.DB.prepare(
      "SELECT last_run_at AS lastRunAt FROM email_scheduler_state WHERE job_key='interview_reminders'"
    ).first();

    if (state?.lastRunAt) {
      const last = Date.parse(String(state.lastRunAt).replace(" ", "T") + "Z");
      if (Number.isFinite(last) && Date.now() - last < 15 * 60 * 1000) {
        return { ran:false };
      }
    }

    await env.DB.prepare(
      `INSERT INTO email_scheduler_state (job_key,last_run_at)
       VALUES ('interview_reminders',CURRENT_TIMESTAMP)
       ON CONFLICT(job_key) DO UPDATE SET last_run_at=CURRENT_TIMESTAMP`
    ).run();

    const { results } = await env.DB.prepare(
      `SELECT a.id AS applicationId, a.jobseeker_id AS userId,
              j.id AS jobId, j.title, j.company,
              ii.interview_at AS interviewAt, ii.location
       FROM applications a
       JOIN jobs j ON j.id=a.job_id
       JOIN interview_invites ii ON ii.application_id=a.id
       WHERE a.status='interview_accepted'
         AND ii.status='accepted'
         AND datetime(ii.interview_at) > datetime('now')
         AND datetime(ii.interview_at) <= datetime('now', '+24 hours')
       ORDER BY datetime(ii.interview_at) ASC
       LIMIT 100`
    ).all();

    for (const row of results || []) {
      const withinHour = await env.DB.prepare(
        `SELECT CASE WHEN datetime(?) <= datetime('now', '+1 hour') THEN 1 ELSE 0 END AS yes`
      ).bind(row.interviewAt).first();

      if (withinHour?.yes) {
        await sendRecruitmentEmail(env, request, {
          userId:row.userId,
          category:"interview_reminder",
          eventType:"interview_reminder_1h",
          eventKey:`email:interview-reminder-1:${row.applicationId}:${row.interviewAt}`,
          subject:`Interview soon: ${row.title}`,
          heading:"Your interview is coming up",
          body:`Your interview for ${row.title} is within the next hour.`,
          applicationId:row.applicationId,
          jobId:row.jobId,
          detailLines:[
            `When: ${String(row.interviewAt).replace("T", " ")}`,
            row.location ? `Where: ${row.location}` : null
          ]
        });
      } else {
        await sendRecruitmentEmail(env, request, {
          userId:row.userId,
          category:"interview_reminder",
          eventType:"interview_reminder_24h",
          eventKey:`email:interview-reminder-24:${row.applicationId}:${row.interviewAt}`,
          subject:`Interview reminder: ${row.title}`,
          heading:"Interview reminder",
          body:`Your interview for ${row.title} with ${row.company || "the employer"} is within 24 hours.`,
          applicationId:row.applicationId,
          jobId:row.jobId,
          detailLines:[
            `When: ${String(row.interviewAt).replace("T", " ")}`,
            row.location ? `Where: ${row.location}` : null
          ]
        });
      }
    }

    return { ran:true, checked:(results || []).length };
  } catch {
    return { ran:false, error:true };
  }
}
