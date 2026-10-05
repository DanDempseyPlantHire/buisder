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
      "SELECT * FROM jobs WHERE status = 'active' ORDER BY created_at DESC"
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
