import { json, getUser } from "../_lib/db.js";

function parseArray(value) {
  if (!value) return [];
  try { return JSON.parse(value); } catch { return []; }
}
function formatJob(j) {
  return {
    ...j,
    tags: parseArray(j.tags),
    schedule_tags: parseArray(j.schedule_tags)
  };
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
              CASE WHEN au.user_id IS NULL THEN 0 ELSE 1 END AS isAdmin
       FROM users u
       LEFT JOIN admin_users au ON au.user_id = u.id
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
      admin: {
        overview: overview || {},
        verifications,
        users: adminUsers,
        jobs: adminJobs,
        auditLog
      }
    });
  }

  if (user.role === "jobseeker") {
    const profile = await env.DB.prepare("SELECT * FROM jobseeker_profiles WHERE user_id = ?").bind(user.id).first();
    const { results: applications } = await env.DB.prepare(
      `SELECT a.id, a.job_id as jobId, a.status, a.created_at as date, j.title, j.company,
              ii.interview_at as interviewAt,
              ii.location as interviewLocation,
              ii.message as interviewMessage,
              ii.status as interviewStatus,
              ii.seen_at as inviteSeenAt
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       LEFT JOIN interview_invites ii ON ii.application_id = a.id
       WHERE a.jobseeker_id = ? ORDER BY a.created_at DESC`
    ).bind(user.id).all();
    const { results: skipRows } = await env.DB.prepare(
      "SELECT job_id FROM skips WHERE jobseeker_id = ?"
    ).bind(user.id).all();
    const { results: jobs } = await env.DB.prepare(
      `SELECT j.*,
              ep.logo_data AS employer_logo,
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
      profile: profile || {},
      jobs: jobs.map(formatJob),
      applications,
      skipped: skipRows.map(r => r.job_id)
    });
  }

  // employer
  const profile = await env.DB.prepare("SELECT * FROM employer_profiles WHERE user_id = ?").bind(user.id).first();
  const { results: postedJobs } = await env.DB.prepare(
    "SELECT * FROM jobs WHERE employer_id = ? ORDER BY created_at DESC"
  ).bind(user.id).all();
  const { results: applicants } = await env.DB.prepare(
    `SELECT a.id, a.job_id as jobId, a.status, a.created_at as date,
            u.id as applicantId, u.name as applicantName, u.email as applicantEmail,
            jp.location as applicantLocation, jp.availability as applicantAvailability, jp.skills as applicantSkills, jp.photo_data as applicantPhoto,
            j.title as jobTitle,
            ii.interview_at as interviewAt,
            ii.location as interviewLocation,
            ii.message as interviewMessage,
            ii.status as interviewStatus,
            ii.seen_at as inviteSeenAt
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     JOIN users u ON u.id = a.jobseeker_id
     LEFT JOIN jobseeker_profiles jp ON jp.user_id = u.id
     LEFT JOIN interview_invites ii ON ii.application_id = a.id
     WHERE j.employer_id = ?
     ORDER BY a.created_at DESC`
  ).bind(user.id).all();

  return json({
    user,
    profile: profile || {},
    postedJobs: postedJobs.map(formatJob),
    applicants
  });
}
