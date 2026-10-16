import { json, getUser, createNotification } from "../_lib/db.js";
import { getCommercialSnapshot } from "../_lib/commercial.js";
import { TERMS_VERSION, PRIVACY_VERSION } from "../_lib/policy.js";
import { maybeSendDueInterviewReminderEmails } from "../_lib/email-notifications.js";

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
    } else {
      await createNotification(env, {
        userId,
        type: "interview_reminder",
        title: "Interview reminder",
        body: `Your interview for ${row.title} with ${row.company || "the employer"} is within 24 hours.`,
        applicationId: row.applicationId,
        jobId: row.jobId,
        eventKey: `interview-reminder-24:${row.applicationId}:${row.interviewAt}`
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


async function getAccountSafety(env, user) {
  const privacy = await env.DB.prepare(
    `SELECT share_email AS shareEmail,
            share_cv AS shareCv,
            share_photo AS sharePhoto,
            share_location AS shareLocation,
            updated_at AS updatedAt
     FROM privacy_preferences WHERE user_id=?`
  ).bind(user.id).first();

  const consent = await env.DB.prepare(
    `SELECT terms_version AS termsVersion,
            privacy_version AS privacyVersion,
            accepted_at AS acceptedAt
     FROM legal_consents
     WHERE user_id=?
     ORDER BY accepted_at DESC LIMIT 1`
  ).bind(user.id).first();

  const emailPreferences = await env.DB.prepare(
    `SELECT recruitment_emails AS recruitmentEmails,
            application_updates AS applicationUpdates,
            interviews,
            interview_reminders AS interviewReminders,
            offers, outcomes, updated_at AS updatedAt
     FROM notification_preferences WHERE user_id=?`
  ).bind(user.id).first();

  const { results: blocks } = await env.DB.prepare(
    `SELECT b.blocked_user_id AS userId, b.created_at AS createdAt,
            u.name, u.role
     FROM user_blocks b
     JOIN users u ON u.id=b.blocked_user_id
     WHERE b.blocker_user_id=?
     ORDER BY b.created_at DESC`
  ).bind(user.id).all();

  const { results: reports } = await env.DB.prepare(
    `SELECT id, target_type AS targetType, reason, details, status,
            created_at AS createdAt, updated_at AS updatedAt
     FROM safety_reports
     WHERE reporter_user_id=?
     ORDER BY created_at DESC LIMIT 30`
  ).bind(user.id).all();

  return {
    privacy: privacy || {
      shareEmail: 1, shareCv: 1, sharePhoto: 1, shareLocation: 1
    },
    consent: consent ? {
      ...consent,
      current: consent.termsVersion === TERMS_VERSION && consent.privacyVersion === PRIVACY_VERSION,
      currentTermsVersion: TERMS_VERSION,
      currentPrivacyVersion: PRIVACY_VERSION
    } : {
      current:false,
      currentTermsVersion:TERMS_VERSION,
      currentPrivacyVersion:PRIVACY_VERSION
    },
    emailPreferences: emailPreferences || {
      recruitmentEmails:1, applicationUpdates:1, interviews:1,
      interviewReminders:1, offers:1, outcomes:1, updatedAt:null
    },
    blocks: blocks || [],
    reports: reports || []
  };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const user = await getUser(context);
  if (!user) return json({ user: null });

  // Best-effort pilot reminder sweep. At most once every 15 minutes and
  // never allowed to break bootstrap if email delivery has a problem.
  await maybeSendDueInterviewReminderEmails(env, request);


  if (user.isAdmin) {
    const overview = await env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM users) AS totalUsers,
        (SELECT COUNT(*) FROM users WHERE role='jobseeker') AS jobseekers,
        (SELECT COUNT(*) FROM users WHERE role='employer') AS employers,
        (SELECT COUNT(*) FROM employer_profiles WHERE verification_status='pending') AS pendingVerifications,
        (SELECT COUNT(*) FROM jobs WHERE status='active') AS activeJobs,
        (SELECT COUNT(*) FROM applications) AS totalApplications,
        (SELECT COUNT(*) FROM safety_reports WHERE status IN ('open','reviewing')) AS openReports`
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

    const { results: moderationReports } = await env.DB.prepare(
      `SELECT r.id, r.target_type AS targetType, r.reason, r.details, r.status,
              r.created_at AS createdAt, r.updated_at AS updatedAt,
              r.target_user_id AS targetUserId, r.job_id AS jobId,
              r.application_id AS applicationId, r.admin_note AS adminNote,
              reporter.email AS reporterEmail,
              target.email AS targetEmail,
              target.name AS targetName,
              target.role AS targetRole,
              j.title AS jobTitle, j.company AS jobCompany
       FROM safety_reports r
       LEFT JOIN users reporter ON reporter.id=r.reporter_user_id
       LEFT JOIN users target ON target.id=r.target_user_id
       LEFT JOIN jobs j ON j.id=r.job_id
       ORDER BY
         CASE r.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,
         r.created_at DESC
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
        reports: moderationReports,
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
              ep.description AS employer_description,
              CASE WHEN jp.job_id IS NOT NULL
                     AND (jp.ends_at IS NULL OR datetime(jp.ends_at)>datetime('now'))
                   THEN 1 ELSE 0 END AS is_featured
       FROM jobs j
       LEFT JOIN employer_profiles ep ON ep.user_id = j.employer_id
       LEFT JOIN job_promotions jp ON jp.job_id=j.id
       WHERE j.status = 'active'
         AND NOT EXISTS (
           SELECT 1 FROM user_blocks b
           WHERE (b.blocker_user_id=? AND b.blocked_user_id=j.employer_id)
              OR (b.blocker_user_id=j.employer_id AND b.blocked_user_id=?)
         )
       ORDER BY
         CASE WHEN jp.job_id IS NOT NULL
                   AND (jp.ends_at IS NULL OR datetime(jp.ends_at)>datetime('now'))
              THEN 0 ELSE 1 END,
         j.created_at DESC`
    ).bind(user.id, user.id).all();

    return json({
      user,
      profile: profileOut,
      jobs: jobs.map(formatJob),
      applications: applications.map(a => ({
        ...a,
        statusHistory: historyByApplication[a.id] || []
      })),
      skipped: skipRows.map(r => r.job_id),
      notifications: await getNotifications(env, user.id),
      account: await getAccountSafety(env, user)
    });
  }

  // employer
  const profile = await env.DB.prepare("SELECT * FROM employer_profiles WHERE user_id = ?").bind(user.id).first();
  const profileOut = profile ? {
    ...profile,
    logo_url: profile.logo_key ? `/api/files/business-logo/${user.id}` : null
  } : {};
  const { results: postedJobs } = await env.DB.prepare(
    `SELECT j.*,
            CASE WHEN jp.job_id IS NOT NULL
                   AND (jp.ends_at IS NULL OR datetime(jp.ends_at)>datetime('now'))
                 THEN 1 ELSE 0 END AS is_featured
     FROM jobs j
     LEFT JOIN job_promotions jp ON jp.job_id=j.id
     WHERE j.employer_id=?
     ORDER BY j.created_at DESC`
  ).bind(user.id).all();
  const { results: applicants } = await env.DB.prepare(
    `SELECT a.id, a.job_id as jobId, a.status, a.created_at as date,
            a.shortlisted_at as shortlistedAt,
            a.interview_invited_at as interviewInvitedAt,
            a.interview_accepted_at as interviewAcceptedAt,
            a.interview_declined_at as interviewDeclinedAt,
            a.interview_completed_at as interviewCompletedAt,
            u.id as applicantId, u.name as applicantName,
            CASE WHEN COALESCE(pp.share_email,1)=1 THEN u.email ELSE NULL END as applicantEmail,
            CASE WHEN COALESCE(pp.share_location,1)=1 THEN jp.location ELSE NULL END as applicantLocation,
            jp.availability as applicantAvailability, jp.skills as applicantSkills,
            CASE WHEN COALESCE(pp.share_photo,1)=1 THEN jp.photo_data ELSE NULL END as applicantPhotoLegacy,
            CASE WHEN COALESCE(pp.share_photo,1)=1 THEN jp.photo_key ELSE NULL END as applicantPhotoKey,
            CASE WHEN COALESCE(pp.share_cv,1)=1 THEN jp.cv_key ELSE NULL END as applicantCvKey,
            CASE WHEN COALESCE(pp.share_cv,1)=1 THEN jp.cv_filename ELSE NULL END as applicantCvFilename,
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
     LEFT JOIN privacy_preferences pp ON pp.user_id = u.id
     LEFT JOIN interview_invites ii ON ii.application_id = a.id
     LEFT JOIN job_offers o ON o.application_id = a.id
     WHERE j.employer_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM user_blocks b
         WHERE (b.blocker_user_id=? AND b.blocked_user_id=u.id)
            OR (b.blocker_user_id=u.id AND b.blocked_user_id=?)
       )
     ORDER BY a.created_at DESC`
  ).bind(user.id, user.id, user.id).all();


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
    notifications: await getNotifications(env, user.id),
    account: await getAccountSafety(env, user),
    commercial: await getCommercialSnapshot(env, user.id)
  });
}
