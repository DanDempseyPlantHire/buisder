import { json, requireAdmin } from "../../_lib/db.js";

function requestedDays(request) {
  const raw = Number(new URL(request.url).searchParams.get("days") || 30);
  return [0, 7, 30, 90, 365].includes(raw) ? raw : 30;
}

function sinceValue(days) {
  if (!days) return null;
  return new Date(Date.now() - days * 86400000).toISOString();
}

function pct(num, den) {
  return den ? Math.round((Number(num || 0) / Number(den)) * 1000) / 10 : 0;
}

async function first(env, sql, args = []) {
  return await env.DB.prepare(sql).bind(...args).first();
}

async function all(env, sql, args = []) {
  const { results } = await env.DB.prepare(sql).bind(...args).all();
  return results || [];
}

function periodClause(column, since) {
  return since ? ` AND datetime(${column}) >= datetime(?)` : "";
}

function parseCategory(tags) {
  try {
    const values = JSON.parse(tags || "[]");
    return Array.isArray(values) && values.length ? String(values[0] || "Other") : "Other";
  } catch {
    return "Other";
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const { error } = await requireAdmin(context);
  if (error) return error;

  const days = requestedDays(request);
  const since = sinceValue(days);
  const periodArgs = since ? [since] : [];

  const userPeriod = periodClause("u.created_at", since);
  const jobPeriod = periodClause("j.created_at", since);
  const appPeriod = periodClause("a.created_at", since);
  const eventPeriod = periodClause("e.created_at", since);

  const users = await first(env,
    `SELECT
       COUNT(*) AS newUsers,
       SUM(CASE WHEN role='jobseeker' THEN 1 ELSE 0 END) AS newJobseekers,
       SUM(CASE WHEN role='employer' THEN 1 ELSE 0 END) AS newEmployers
     FROM users u
     WHERE u.id <> 'seed-employer'${userPeriod}`,
    periodArgs
  );

  const profileCohort = await first(env,
    `SELECT
       SUM(CASE WHEN u.role='jobseeker' THEN 1 ELSE 0 END) AS jobseekers,
       SUM(CASE WHEN u.role='jobseeker' AND COALESCE(jp.onboarding_complete,0)=1 THEN 1 ELSE 0 END) AS completed
     FROM users u
     LEFT JOIN jobseeker_profiles jp ON jp.user_id=u.id
     WHERE u.id <> 'seed-employer'${userPeriod}`,
    periodArgs
  );

  const jobs = await first(env,
    `SELECT
       COUNT(*) AS jobsPosted,
       SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS activeAmongPeriod
     FROM jobs j
     WHERE j.employer_id <> 'seed-employer'${jobPeriod}`,
    periodArgs
  );

  const activeJobs = await first(env,
    `SELECT COUNT(*) AS activeJobs
     FROM jobs
     WHERE employer_id <> 'seed-employer' AND status='active'`
  );

  const funnel = await first(env,
    `WITH cohort AS (
       SELECT a.id, a.job_id, a.status, a.shortlisted_at, a.interview_invited_at,
              a.interview_accepted_at, a.interview_completed_at, a.created_at
       FROM applications a
       JOIN jobs j ON j.id=a.job_id
       WHERE j.employer_id <> 'seed-employer'${appPeriod}
     )
     SELECT
       COUNT(*) AS applications,
       SUM(CASE WHEN c.shortlisted_at IS NOT NULL OR EXISTS (
         SELECT 1 FROM application_status_history h
         WHERE h.application_id=c.id AND h.status='shortlisted'
       ) THEN 1 ELSE 0 END) AS shortlisted,
       SUM(CASE WHEN c.interview_invited_at IS NOT NULL OR EXISTS (
         SELECT 1 FROM interview_invites ii WHERE ii.application_id=c.id
       ) THEN 1 ELSE 0 END) AS interviewInvited,
       SUM(CASE WHEN c.interview_accepted_at IS NOT NULL OR EXISTS (
         SELECT 1 FROM application_status_history h
         WHERE h.application_id=c.id AND h.status='interview_accepted'
       ) THEN 1 ELSE 0 END) AS interviewAccepted,
       SUM(CASE WHEN c.interview_completed_at IS NOT NULL OR EXISTS (
         SELECT 1 FROM application_status_history h
         WHERE h.application_id=c.id AND h.status='interview_completed'
       ) THEN 1 ELSE 0 END) AS interviewCompleted,
       SUM(CASE WHEN EXISTS (
         SELECT 1 FROM job_offers o WHERE o.application_id=c.id
       ) OR EXISTS (
         SELECT 1 FROM application_status_history h
         WHERE h.application_id=c.id AND h.status='offer_made'
       ) THEN 1 ELSE 0 END) AS offers,
       SUM(CASE WHEN EXISTS (
         SELECT 1 FROM job_offers o WHERE o.application_id=c.id AND o.status='accepted'
       ) OR EXISTS (
         SELECT 1 FROM application_status_history h
         WHERE h.application_id=c.id AND h.status='offer_accepted'
       ) THEN 1 ELSE 0 END) AS offersAccepted,
       SUM(CASE WHEN c.status='hired' OR EXISTS (
         SELECT 1 FROM application_status_history h
         WHERE h.application_id=c.id AND h.status='hired'
       ) THEN 1 ELSE 0 END) AS hired,
       SUM(CASE WHEN c.status='unsuccessful' OR EXISTS (
         SELECT 1 FROM application_status_history h
         WHERE h.application_id=c.id AND h.status='unsuccessful'
       ) THEN 1 ELSE 0 END) AS unsuccessful,
       SUM(CASE WHEN c.status='withdrawn' OR EXISTS (
         SELECT 1 FROM application_status_history h
         WHERE h.application_id=c.id AND h.status='withdrawn'
       ) THEN 1 ELSE 0 END) AS withdrawn
     FROM cohort c`,
    periodArgs
  );

  const engagement = await first(env,
    `SELECT
       COUNT(DISTINCT CASE WHEN event_type='app_open' THEN user_id END) AS activeUsers,
       SUM(CASE WHEN event_type='job_view' THEN 1 ELSE 0 END) AS jobViews,
       COUNT(DISTINCT CASE WHEN event_type='job_view' THEN user_id END) AS jobViewers,
       SUM(CASE WHEN event_type='job_skip' THEN 1 ELSE 0 END) AS skips,
       SUM(CASE WHEN event_type='application_submitted' THEN 1 ELSE 0 END) AS applicationEvents
     FROM analytics_events e
     WHERE 1=1${eventPeriod}`,
    periodArgs
  );

  const employerConversion = await first(env,
    `WITH employer_jobs AS (
       SELECT DISTINCT j.employer_id
       FROM jobs j
       WHERE j.employer_id <> 'seed-employer'${jobPeriod}
     ),
     employer_apps AS (
       SELECT DISTINCT j.employer_id
       FROM applications a
       JOIN jobs j ON j.id=a.job_id
       JOIN employer_jobs ej ON ej.employer_id=j.employer_id
     ),
     employer_hires AS (
       SELECT DISTINCT j.employer_id
       FROM applications a
       JOIN jobs j ON j.id=a.job_id
       JOIN employer_jobs ej ON ej.employer_id=j.employer_id
       WHERE a.status='hired'
          OR EXISTS (
            SELECT 1 FROM application_status_history h
            WHERE h.application_id=a.id AND h.status='hired'
          )
     )
     SELECT
       (SELECT COUNT(*) FROM employer_jobs) AS employersPosting,
       (SELECT COUNT(*) FROM employer_apps) AS employersWithApplicants,
       (SELECT COUNT(*) FROM employer_hires) AS employersWithHires`,
    periodArgs
  );

  const avgTime = await first(env,
    `SELECT ROUND(AVG(julianday(h.created_at)-julianday(a.created_at)),1) AS avgDays
     FROM application_status_history h
     JOIN applications a ON a.id=h.application_id
     JOIN jobs j ON j.id=a.job_id
     WHERE h.status='hired'
       AND j.employer_id <> 'seed-employer'${since ? " AND datetime(a.created_at) >= datetime(?)" : ""}`,
    periodArgs
  );

  const jobRows = await all(env,
    `SELECT
       j.id, j.title, j.company, j.location, j.tags, j.status, j.created_at AS createdAt,
       COUNT(a.id) AS applications,
       SUM(CASE WHEN a.shortlisted_at IS NOT NULL OR EXISTS (
         SELECT 1 FROM application_status_history h
         WHERE h.application_id=a.id AND h.status='shortlisted'
       ) THEN 1 ELSE 0 END) AS shortlisted,
       SUM(CASE WHEN a.interview_invited_at IS NOT NULL OR EXISTS (
         SELECT 1 FROM interview_invites ii WHERE ii.application_id=a.id
       ) THEN 1 ELSE 0 END) AS interviews,
       SUM(CASE WHEN EXISTS (
         SELECT 1 FROM job_offers o WHERE o.application_id=a.id
       ) THEN 1 ELSE 0 END) AS offers,
       SUM(CASE WHEN a.status='hired' OR EXISTS (
         SELECT 1 FROM application_status_history h
         WHERE h.application_id=a.id AND h.status='hired'
       ) THEN 1 ELSE 0 END) AS hires
     FROM jobs j
     LEFT JOIN applications a
       ON a.job_id=j.id${since ? " AND datetime(a.created_at) >= datetime(?)" : ""}
     WHERE j.employer_id <> 'seed-employer'
     GROUP BY j.id
     ORDER BY applications DESC, hires DESC, j.created_at DESC
     LIMIT 100`,
    periodArgs
  );

  const categories = {};
  const locations = {};
  for (const row of jobRows) {
    const category = parseCategory(row.tags);
    if (!categories[category]) categories[category] = { category, applications: 0, hires: 0, jobs: 0 };
    categories[category].applications += Number(row.applications || 0);
    categories[category].hires += Number(row.hires || 0);
    categories[category].jobs += 1;

    const location = String(row.location || "Not specified").trim() || "Not specified";
    if (!locations[location]) locations[location] = { location, applications: 0, hires: 0, jobs: 0 };
    locations[location].applications += Number(row.applications || 0);
    locations[location].hires += Number(row.hires || 0);
    locations[location].jobs += 1;
  }

  const categoriesOut = Object.values(categories)
    .sort((a,b)=>b.applications-a.applications || b.hires-a.hires)
    .slice(0, 8);
  const locationsOut = Object.values(locations)
    .sort((a,b)=>b.applications-a.applications || b.hires-a.hires)
    .slice(0, 8);

  const topJobs = jobRows
    .filter(j => Number(j.applications || 0) > 0 || Number(j.hires || 0) > 0)
    .slice(0, 10)
    .map(j => ({
      id: j.id,
      title: j.title,
      company: j.company,
      location: j.location,
      status: j.status,
      applications: Number(j.applications || 0),
      shortlisted: Number(j.shortlisted || 0),
      interviews: Number(j.interviews || 0),
      offers: Number(j.offers || 0),
      hires: Number(j.hires || 0)
    }));

  const trendSince = new Date(Date.now() - 13 * 86400000).toISOString();
  const signupsTrend = await all(env,
    `SELECT date(created_at) AS day, COUNT(*) AS count
     FROM users
     WHERE id <> 'seed-employer' AND datetime(created_at) >= datetime(?)
     GROUP BY date(created_at)`,
    [trendSince]
  );
  const appsTrend = await all(env,
    `SELECT date(a.created_at) AS day, COUNT(*) AS count
     FROM applications a JOIN jobs j ON j.id=a.job_id
     WHERE j.employer_id <> 'seed-employer' AND datetime(a.created_at) >= datetime(?)
     GROUP BY date(a.created_at)`,
    [trendSince]
  );
  const hiresTrend = await all(env,
    `SELECT date(h.created_at) AS day, COUNT(DISTINCT h.application_id) AS count
     FROM application_status_history h
     JOIN applications a ON a.id=h.application_id
     JOIN jobs j ON j.id=a.job_id
     WHERE h.status='hired' AND j.employer_id <> 'seed-employer'
       AND datetime(h.created_at) >= datetime(?)
     GROUP BY date(h.created_at)`,
    [trendSince]
  );

  const trendMap = {};
  for (let i=13;i>=0;i--) {
    const d = new Date(Date.now() - i*86400000).toISOString().slice(0,10);
    trendMap[d] = { day:d, signups:0, applications:0, hires:0 };
  }
  for (const r of signupsTrend) if (trendMap[r.day]) trendMap[r.day].signups = Number(r.count || 0);
  for (const r of appsTrend) if (trendMap[r.day]) trendMap[r.day].applications = Number(r.count || 0);
  for (const r of hiresTrend) if (trendMap[r.day]) trendMap[r.day].hires = Number(r.count || 0);

  const f = {
    applications: Number(funnel?.applications || 0),
    shortlisted: Number(funnel?.shortlisted || 0),
    interviewInvited: Number(funnel?.interviewInvited || 0),
    interviewAccepted: Number(funnel?.interviewAccepted || 0),
    interviewCompleted: Number(funnel?.interviewCompleted || 0),
    offers: Number(funnel?.offers || 0),
    offersAccepted: Number(funnel?.offersAccepted || 0),
    hired: Number(funnel?.hired || 0),
    unsuccessful: Number(funnel?.unsuccessful || 0),
    withdrawn: Number(funnel?.withdrawn || 0)
  };

  const decisions = Number(engagement?.skips || 0) + Number(engagement?.applicationEvents || 0);

  return json({
    period: { days, since },
    kpis: {
      newUsers: Number(users?.newUsers || 0),
      newJobseekers: Number(users?.newJobseekers || 0),
      newEmployers: Number(users?.newEmployers || 0),
      profileCompletionRate: pct(profileCohort?.completed, profileCohort?.jobseekers),
      jobsPosted: Number(jobs?.jobsPosted || 0),
      activeJobs: Number(activeJobs?.activeJobs || 0),
      activeUsers: Number(engagement?.activeUsers || 0),
      jobViews: Number(engagement?.jobViews || 0),
      avgDaysToHire: avgTime?.avgDays === null || avgTime?.avgDays === undefined
        ? null : Number(avgTime.avgDays)
    },
    funnel: f,
    rates: {
      applicationToShortlist: pct(f.shortlisted, f.applications),
      applicationToInterview: pct(f.interviewInvited, f.applications),
      applicationToOffer: pct(f.offers, f.applications),
      applicationToHire: pct(f.hired, f.applications),
      interviewToOffer: pct(f.offers, f.interviewCompleted || f.interviewInvited),
      offerAcceptance: pct(f.offersAccepted, f.offers),
      swipeRightRate: pct(engagement?.applicationEvents, decisions),
      viewToApply: pct(engagement?.applicationEvents, engagement?.jobViews),
      employerApplicantConversion: pct(employerConversion?.employersWithApplicants, employerConversion?.employersPosting),
      employerHireConversion: pct(employerConversion?.employersWithHires, employerConversion?.employersPosting)
    },
    employerConversion: {
      employersPosting: Number(employerConversion?.employersPosting || 0),
      employersWithApplicants: Number(employerConversion?.employersWithApplicants || 0),
      employersWithHires: Number(employerConversion?.employersWithHires || 0)
    },
    engagement: {
      activeUsers: Number(engagement?.activeUsers || 0),
      jobViews: Number(engagement?.jobViews || 0),
      jobViewers: Number(engagement?.jobViewers || 0),
      skips: Number(engagement?.skips || 0),
      applications: Number(engagement?.applicationEvents || 0)
    },
    topJobs,
    categories: categoriesOut,
    locations: locationsOut,
    trend: Object.values(trendMap),
    notes: {
      engagementTracking: "App opens and job views are measured from v16 onward.",
      historicalSwipeCaveat: "The v16 migration backfills recoverable applications and current skip rows. Older skips that were undone or later converted to applications cannot be reconstructed."
    }
  }, { headers: { "Cache-Control": "no-store" } });
}
