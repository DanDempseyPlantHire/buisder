import { json, getUser, createNotification } from "../_lib/db.js";

function parseArray(value) {
  if (!value) return [];
  try { return JSON.parse(value); } catch { return []; }
}
function formatJob(j) {
  return {
    ...j,
    tags: parseArray(j.tags),
    schedule_tags: parseArray(j.schedule_tags),
    employer_logo: j.employer_logo_key
      ? `/api/files/business-logo/${j.employer_id}`
      : (j.employer_logo || null)
  };
}


async function ensureInterviewReminders(env, userId) {
  const { results } = await env.DB.prepare(
    `SELECT a.id AS applicationId, j.id AS jobId, j.title, j.company, ii.interview_at AS interviewAt
     FROM applications a
     JOIN jobs j ON j.id=a.job_id
     JOIN interview_invites ii ON ii.application_id=a.id
     WHERE a.jobseeker_id=?
       AND a.status='interview_accepted'
       AND ii.status='accepted'
       AND datetime(ii.interview_at) > datetime('now')
       AND datetime(ii.interview_at) <= datetime('now', '+24 hours')`
  ).bind(userId).all();

  for (const row of results) {
    await createNotification(env, {
      userId,
      type: "interview_reminder",
      title: "Interview reminder",
      body: `Your interview for ${row.title} with ${row.company || "the employer"} is within 24 hours.`,
      applicationId: row.applicationId,
      jobId: row.jobId,
      eventKey: `interview-reminder-24:${row.applicationId}:${row.interviewAt}`
    });

    const withinHour = await env.DB.prepare(
      `SELECT CASE
         WHEN datetime(?) <= datetime('now', '+1 hour') THEN 1 ELSE 0
       END AS yes`
    ).bind(row.interviewAt).first();

    if (withinHour?.yes) {
      await createNotification(env, {
        userId,
        type: "interview_reminder",
        title: "Interview in the next hour",
        body: `Your interview for ${row.title} is coming up soon.`,
        applicationId: row.applicationId,
        jobId: row.jobId,
        eventKey: `interview-reminder-1:${row.applicationId}:${row.interviewAt}`
      });
    }
  }
}

async function getNotifications(env, userId) {
  const { results } = await env.DB.prepare(
    `SELECT id, type, title, body,
            application_id AS applicationId,
            job_id AS jobId,
            read_at AS readAt,
            created_at AS createdAt
     FROM notifications
     WHERE user_id=?
     ORDER BY created_at DESC
     LIMIT 60`
  ).bind(userId).all();
  return results || [];
}

export async function onRequestGet(context) {
  const { env } = context;
  const user = await getUser(context);
  if (!user) return json({ user: null });


  if (user.isAdmin) {
    const overview = await env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM users) AS totalUsers,
        (SELECT COUNT(*) FROM users WHERE role='jobseeker') AS jobseekers,
        (SELECT COUNT(*) FROM users WHERE role='employer') AS employers,
        (SELECT COUNT(*) FROM employer_profiles WHERE verification_status='pending') AS pendingVerifications,
        (SELECT COUNT(*) FROM jobs WHERE status='active') AS activeJobs,
        (SELECT COUNT(*) FROM applications) AS totalApplications`
    ).first();

    const { results: verifications } = await env.DB.prepare(
      `SELECT ep.user_id AS userId,
              u.name AS contactName,
              u.email,
              ep.company_name AS companyName,
              ep.legal_name AS legalName,
              ep.location,
              ep.description,
              ep.phone,
              ep.website,
              ep.registration_number AS registrationNumber,
              ep.logo_data AS logoData,
              ep.logo_key AS logoKey,
              ep.verification_status AS verificationStatus,
              ep.verification_submitted_at AS submittedAt,
              ep.verification_reviewed_at AS reviewedAt,
              ep.verification_note AS verificationNote
       FROM employer_profiles ep
       JOIN users u ON u.id = ep.user_id
       ORDER BY
         CASE ep.verification_status
           WHEN 'pending' THEN 0
           WHEN 'unverified' THEN 1
           WHEN 'rejected' THEN 2
           ELSE 3
         END,
         ep.verification_submitted_at DESC,
         u.created_at DESC
       LIMIT 100`
    ).all();

    const { results: adminUsers } = await env.DB.prepare(
      `SELECT u.id, u.email, u.name, u.role, u.is_suspended AS isSuspended, u.created_at AS createdAt,
              CASE WHEN au.user_id IS NULL THEN 0 ELSE 1 END AS isAdmin,
              CASE WHEN ve.user_id IS NULL THEN 0 ELSE 1 END AS emailVerified
       FROM users u
       LEFT JOIN admin_users au ON au.user_id = u.id
       LEFT JOIN verified_emails ve ON ve.user_id = u.id
       ORDER BY u.created_at DESC
       LIMIT 100`
    ).all();

    const { results: adminJobs } = await env.DB.prepare(
      `SELECT j.id, j.title, j.company, j.location, j.status, j.created_at AS createdAt,
              u.email AS employerEmail,
              ep.verification_status AS employerVerificationStatus
       FROM jobs j
       JOIN users u ON u.id = j.employer_id
       LEFT JOIN employer_profiles ep ON ep.user_id = j.employer_id
       ORDER BY j.created_at DESC
       LIMIT 100`
    ).all();

    const { results: auditLog } = await env.DB.prepare(
      `SELECT al.id, al.action, al.target_type AS targetType, al.target_id AS targetId,
              al.details, al.created_at AS createdAt,
              u.email AS adminEmail
       FROM admin_audit_log al
       JOIN users u ON u.id = al.admin_user_id
       ORDER BY al.created_at DESC
       LIMIT 50`
    ).all();

    return json({
      user,
      notifications: await getNotifications(env, user.id),
      admin: {
        overview: overview || {},
        verifications: verifications.map(v => ({
          ...v,
          logoData: v.logoKey ? `/api/files/business-logo/${v.userId}` : v.logoData
        })),
        users: adminUsers,
        jobs: adminJobs,
        auditLog
      }
    });
  }

  if (user.role === "jobseeker") {
    await ensureInterviewReminders(env, user.id);

    const profile = await env.DB.prepare("SELECT * FROM jobseeker_profiles WHERE user_id = ?").bind(user.id).first();
    const profileOut = profile ? {
      ...profile,
      photo_url: profile.photo_key ? `/api/files/profile-photo/${user.id}` : null,
      cv_url: profile.cv_key ? `/api/files/cv/${user.id}` : null
    } : {};
    const { results: applications } = await env.DB.prepare(
      `SELECT a.id, a.job_id as jobId, a.status, a.created_at as date,
              a.shortlisted_at as shortlistedAt,
              a.interview_invited_at as interviewInvitedAt,
              a.interview_accepted_at as interviewAcceptedAt,
              a.interview_declined_at as interviewDeclinedAt,
              a.interview_completed_at as interviewCompletedAt,
              j.title, j.company,
              ii.interview_at as interviewAt,
              ii.location as interviewLocation,
              ii.message as interviewMessage,
              ii.status as interviewStatus,
              ii.seen_at as inviteSeenAt,
              o.role_title as offerRoleTitle,
              o.pay as offerPay,
              o.start_date as offerStartDate,
              o.message as offerMessage,
              o.status as offerStatus,
              o.created_at as offerCreatedAt,
              o.responded_at as offerRespondedAt
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       LEFT JOIN interview_invites ii ON ii.application_id = a.id
       LEFT JOIN job_offers o ON o.application_id = a.id
       WHERE a.jobseeker_id = ? ORDER BY a.created_at DESC`
    ).bind(user.id).all();
    const { results: historyRows } = await env.DB.prepare(
      `SELECT h.application_id as applicationId,
              h.status,
              NULL AS note,
              h.created_at as createdAt,
              actor.id AS actorUserId,
              actor.name AS actorName,
              actor.role AS actorRole
       FROM application_status_history h
       JOIN applications a ON a.id=h.application_id
       LEFT JOIN users actor ON actor.id=h.actor_user_id
       WHERE a.jobseeker_id=?
       ORDER BY h.created_at ASC`
    ).bind(user.id).all();

    const historyByApplication = {};
    for (const row of historyRows) {
      if (!historyByApplication[row.applicationId]) historyByApplication[row.applicationId] = [];
      historyByApplication[row.applicationId].push(row);
    }

    const { results: skipRows } = await env.DB.prepare(
      "SELECT job_id FROM skips WHERE jobseeker_id = ?"
    ).bind(user.id).all();
    const { results: jobs } = await env.DB.prepare(
      `SELECT j.*,
              ep.logo_data AS employer_logo,
              ep.logo_key AS employer_logo_key,
              ep.verification_status AS employer_verification_status,
              ep.website AS employer_website,
              ep.description AS employer_description
       FROM jobs j
       LEFT JOIN employer_profiles ep ON ep.user_id = j.employer_id
       WHERE j.status = 'active'
       ORDER BY j.created_at DESC`
    ).all();

    return json({
      user,
      profile: profileOut,
      jobs: jobs.map(formatJob),
      applications: applications.map(a => ({
        ...a,
        statusHistory: historyByApplication[a.id] || []
      })),
      skipped: skipRows.map(r => r.job_id),
      notifications: await getNotifications(env, user.id)
    });
  }

  // employer
  const profile = await env.DB.prepare("SELECT * FROM employer_profiles WHERE user_id = ?").bind(user.id).first();
  const profileOut = profile ? {
    ...profile,
    logo_url: profile.logo_key ? `/api/files/business-logo/${user.id}` : null
  } : {};
  const { results: postedJobs } = await env.DB.prepare(
    "SELECT * FROM jobs WHERE employer_id = ? ORDER BY created_at DESC"
  ).bind(user.id).all();
  const { results: applicants } = await env.DB.prepare(
    `SELECT a.id, a.job_id as jobId, a.status, a.created_at as date,
            a.shortlisted_at as shortlistedAt,
            a.interview_invited_at as interviewInvitedAt,
            a.interview_accepted_at as interviewAcceptedAt,
            a.interview_declined_at as interviewDeclinedAt,
            a.interview_completed_at as interviewCompletedAt,
            u.id as applicantId, u.name as applicantName, u.email as applicantEmail,
            jp.location as applicantLocation, jp.availability as applicantAvailability, jp.skills as applicantSkills,
            jp.photo_data as applicantPhotoLegacy, jp.photo_key as applicantPhotoKey,
            jp.cv_key as applicantCvKey, jp.cv_filename as applicantCvFilename,
            j.title as jobTitle,
            ii.interview_at as interviewAt,
            ii.location as interviewLocation,
            ii.message as interviewMessage,
            ii.status as interviewStatus,
            ii.seen_at as inviteSeenAt,
            o.role_title as offerRoleTitle,
            o.pay as offerPay,
            o.start_date as offerStartDate,
            o.message as offerMessage,
            o.status as offerStatus,
            o.created_at as offerCreatedAt,
            o.responded_at as offerRespondedAt
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     JOIN users u ON u.id = a.jobseeker_id
     LEFT JOIN jobseeker_profiles jp ON jp.user_id = u.id
     LEFT JOIN interview_invites ii ON ii.application_id = a.id
     LEFT JOIN job_offers o ON o.application_id = a.id
     WHERE j.employer_id = ?
     ORDER BY a.created_at DESC`
  ).bind(user.id).all();


  const { results: employerHistoryRows } = await env.DB.prepare(
    `SELECT h.application_id AS applicationId,
            h.status,
            h.note,
            h.created_at AS createdAt,
            actor.id AS actorUserId,
            actor.name AS actorName,
            actor.role AS actorRole
     FROM application_status_history h
     JOIN applications a ON a.id=h.application_id
     JOIN jobs j ON j.id=a.job_id
     LEFT JOIN users actor ON actor.id=h.actor_user_id
     WHERE j.employer_id=?
     ORDER BY h.created_at ASC`
  ).bind(user.id).all();

  const employerHistoryByApplication = {};
  for (const row of employerHistoryRows) {
    if (!employerHistoryByApplication[row.applicationId]) {
      employerHistoryByApplication[row.applicationId] = [];
    }
    employerHistoryByApplication[row.applicationId].push(row);
  }

  return json({
    user,
    profile: profileOut,
    postedJobs: postedJobs.map(formatJob),
    applicants: applicants.map(a => ({
      ...a,
      applicantPhoto: a.applicantPhotoKey
        ? `/api/files/profile-photo/${a.applicantId}`
        : (a.applicantPhotoLegacy || null),
      applicantCvUrl: a.applicantCvKey
        ? `/api/files/cv/${a.applicantId}`
        : null,
      statusHistory: employerHistoryByApplication[a.id] || []
    })),
    notifications: await getNotifications(env, user.id)
  });
}
