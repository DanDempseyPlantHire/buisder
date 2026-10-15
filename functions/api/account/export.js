import { requireUser } from "../../_lib/db.js";

async function all(env, sql, ...args) {
  const stmt = env.DB.prepare(sql).bind(...args);
  const { results } = await stmt.all();
  return results || [];
}

export async function onRequestGet(context) {
  const { env } = context;
  const { user, error } = await requireUser(context);
  if (error) return error;

  const account = await env.DB.prepare(
    "SELECT id, email, role, name, created_at AS createdAt FROM users WHERE id=?"
  ).bind(user.id).first();

  const privacy = await env.DB.prepare(
    `SELECT share_email AS shareEmail,
            share_cv AS shareCv,
            share_photo AS sharePhoto,
            share_location AS shareLocation,
            updated_at AS updatedAt
     FROM privacy_preferences WHERE user_id=?`
  ).bind(user.id).first();

  const consents = await all(
    env,
    `SELECT terms_version AS termsVersion,
            privacy_version AS privacyVersion,
            accepted_at AS acceptedAt
     FROM legal_consents
     WHERE user_id=?
     ORDER BY accepted_at DESC`,
    user.id
  );

  const notifications = await all(
    env,
    `SELECT type, title, body, application_id AS applicationId,
            job_id AS jobId, read_at AS readAt, created_at AS createdAt
     FROM notifications
     WHERE user_id=?
     ORDER BY created_at DESC`,
    user.id
  );

  const reportsSubmitted = await all(
    env,
    `SELECT target_type AS targetType, target_user_id AS targetUserId,
            job_id AS jobId, application_id AS applicationId,
            reason, details, status, created_at AS createdAt, updated_at AS updatedAt
     FROM safety_reports
     WHERE reporter_user_id=?
     ORDER BY created_at DESC`,
    user.id
  );

  const blocks = await all(
    env,
    `SELECT blocked_user_id AS blockedUserId, created_at AS createdAt
     FROM user_blocks WHERE blocker_user_id=?`,
    user.id
  );

  const analyticsEvents = await all(
    env,
    `SELECT event_type AS eventType, job_id AS jobId,
            application_id AS applicationId, created_at AS createdAt
     FROM analytics_events
     WHERE user_id=?
     ORDER BY created_at DESC`,
    user.id
  );

  const exportData = {
    generatedAt: new Date().toISOString(),
    account,
    privacy: privacy || null,
    legalConsents: consents,
    notifications,
    reportsSubmitted,
    blocks,
    analyticsEvents
  };

  if (user.role === "jobseeker") {
    exportData.profile = await env.DB.prepare(
      `SELECT age_band AS ageBand, phone, location, about, skills, education,
              experience, availability, interests, transport, cv_filename AS cvFilename,
              cv_content_type AS cvContentType, cv_size AS cvSize,
              max_distance_km AS maxDistanceKm, min_pay AS minPay,
              preferred_employment_type AS preferredEmploymentType,
              latitude, longitude
       FROM jobseeker_profiles WHERE user_id=?`
    ).bind(user.id).first();

    exportData.applications = await all(
      env,
      `SELECT a.id, a.job_id AS jobId, a.status, a.created_at AS createdAt,
              a.updated_at AS updatedAt, j.title, j.company
       FROM applications a
       JOIN jobs j ON j.id=a.job_id
       WHERE a.jobseeker_id=?
       ORDER BY a.created_at DESC`,
      user.id
    );

    exportData.applicationHistory = await all(
      env,
      `SELECT h.application_id AS applicationId, h.status,
              h.created_at AS createdAt
       FROM application_status_history h
       JOIN applications a ON a.id=h.application_id
       WHERE a.jobseeker_id=?
       ORDER BY h.created_at ASC`,
      user.id
    );

    exportData.interviews = await all(
      env,
      `SELECT ii.application_id AS applicationId,
              ii.interview_at AS interviewAt, ii.location,
              ii.message, ii.status
       FROM interview_invites ii
       JOIN applications a ON a.id=ii.application_id
       WHERE a.jobseeker_id=?`,
      user.id
    );

    exportData.offers = await all(
      env,
      `SELECT application_id AS applicationId, role_title AS roleTitle,
              pay, start_date AS startDate, message, status,
              created_at AS createdAt, responded_at AS respondedAt
       FROM job_offers WHERE jobseeker_id=?`,
      user.id
    );

    exportData.storedFiles = {
      profilePhoto: "/api/files/profile-photo/" + user.id,
      cv: "/api/files/cv/" + user.id
    };
  } else {
    exportData.profile = await env.DB.prepare(
      `SELECT company_name AS companyName, legal_name AS legalName,
              location, description, phone, website,
              registration_number AS registrationNumber,
              verification_status AS verificationStatus,
              verification_submitted_at AS verificationSubmittedAt,
              verification_reviewed_at AS verificationReviewedAt
       FROM employer_profiles WHERE user_id=?`
    ).bind(user.id).first();

    exportData.jobs = await all(
      env,
      `SELECT id, title, company, location, pay, hours, experience,
              start_date AS startDate, description, employment_type AS employmentType,
              min_age AS minAge, pay_min AS payMin, status, created_at AS createdAt
       FROM jobs WHERE employer_id=? ORDER BY created_at DESC`,
      user.id
    );

    exportData.storedFiles = {
      businessLogo: "/api/files/business-logo/" + user.id
    };
  }

  const body = JSON.stringify(exportData, null, 2);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="buisder-data-export-${date}.json"`,
      "Cache-Control": "no-store"
    }
  });
}
