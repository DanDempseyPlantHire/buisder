// Consolidated Pages Functions routes. Generated for Deas Jobs v24.4 compact deployment.
import { err, json, requireUser } from "../../_lib/db.js";

// Source route: analytics.js
const route0 = (() => {
  function requestedDays(request) {
    const raw = Number(new URL(request.url).searchParams.get("days") || 30);
    return [0, 7, 30, 90, 365].includes(raw) ? raw : 30;
  }
  function sinceValue(days) {
    return days ? new Date(Date.now() - days * 86400000).toISOString() : null;
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
  
  async function onRequestGet(context) {
    const { request, env } = context;
    const { user, error } = await requireUser(context, "employer");
    if (error) return error;
  
    const days = requestedDays(request);
    const since = sinceValue(days);
    const period = since ? " AND datetime(a.created_at) >= datetime(?)" : "";
    const args = since ? [user.id, since] : [user.id];
  
    const funnel = await first(env,
      `WITH cohort AS (
         SELECT a.id, a.status, a.shortlisted_at, a.interview_invited_at,
                a.interview_accepted_at, a.interview_completed_at, a.created_at
         FROM applications a
         JOIN jobs j ON j.id=a.job_id
         WHERE j.employer_id=?${period}
       )
       SELECT
         COUNT(*) AS applications,
         SUM(CASE WHEN c.shortlisted_at IS NOT NULL OR EXISTS (
           SELECT 1 FROM application_status_history h WHERE h.application_id=c.id AND h.status='shortlisted'
         ) THEN 1 ELSE 0 END) AS shortlisted,
         SUM(CASE WHEN c.interview_invited_at IS NOT NULL OR EXISTS (
           SELECT 1 FROM interview_invites ii WHERE ii.application_id=c.id
         ) THEN 1 ELSE 0 END) AS interviews,
         SUM(CASE WHEN EXISTS (
           SELECT 1 FROM job_offers o WHERE o.application_id=c.id
         ) THEN 1 ELSE 0 END) AS offers,
         SUM(CASE WHEN EXISTS (
           SELECT 1 FROM job_offers o WHERE o.application_id=c.id AND o.status='accepted'
         ) THEN 1 ELSE 0 END) AS offersAccepted,
         SUM(CASE WHEN c.status='hired' OR EXISTS (
           SELECT 1 FROM application_status_history h WHERE h.application_id=c.id AND h.status='hired'
         ) THEN 1 ELSE 0 END) AS hired
       FROM cohort c`,
      args
    );
  
    const jobArgs = since ? [since, user.id] : [user.id];
    const jobs = await all(env,
      `SELECT
         j.id, j.title, j.status, j.location, j.created_at AS createdAt,
         COUNT(a.id) AS applications,
         SUM(CASE WHEN a.shortlisted_at IS NOT NULL OR EXISTS (
           SELECT 1 FROM application_status_history h WHERE h.application_id=a.id AND h.status='shortlisted'
         ) THEN 1 ELSE 0 END) AS shortlisted,
         SUM(CASE WHEN a.interview_invited_at IS NOT NULL OR EXISTS (
           SELECT 1 FROM interview_invites ii WHERE ii.application_id=a.id
         ) THEN 1 ELSE 0 END) AS interviews,
         SUM(CASE WHEN EXISTS (
           SELECT 1 FROM job_offers o WHERE o.application_id=a.id
         ) THEN 1 ELSE 0 END) AS offers,
         SUM(CASE WHEN a.status='hired' OR EXISTS (
           SELECT 1 FROM application_status_history h WHERE h.application_id=a.id AND h.status='hired'
         ) THEN 1 ELSE 0 END) AS hires
       FROM jobs j
       LEFT JOIN applications a
         ON a.job_id=j.id${since ? " AND datetime(a.created_at) >= datetime(?)" : ""}
       WHERE j.employer_id=?
       GROUP BY j.id
       ORDER BY applications DESC, hires DESC, j.created_at DESC`,
      jobArgs
    );
  
    const jobSummary = await first(env,
      `SELECT COUNT(*) AS totalJobs,
              SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS activeJobs
       FROM jobs WHERE employer_id=?`,
      [user.id]
    );
  
    const avgTimeArgs = since ? [user.id, since] : [user.id];
    const avgTime = await first(env,
      `SELECT ROUND(AVG(julianday(h.created_at)-julianday(a.created_at)),1) AS avgDays
       FROM application_status_history h
       JOIN applications a ON a.id=h.application_id
       JOIN jobs j ON j.id=a.job_id
       WHERE h.status='hired' AND j.employer_id=?${since ? " AND datetime(a.created_at) >= datetime(?)" : ""}`,
      avgTimeArgs
    );
  
    const views = await first(env,
      `SELECT COUNT(*) AS jobViews,
              COUNT(DISTINCT e.user_id) AS uniqueViewers
       FROM analytics_events e
       JOIN jobs j ON j.id=e.job_id
       WHERE e.event_type='job_view' AND j.employer_id=?${since ? " AND datetime(e.created_at) >= datetime(?)" : ""}`,
      avgTimeArgs
    );
  
    const f = {
      applications: Number(funnel?.applications || 0),
      shortlisted: Number(funnel?.shortlisted || 0),
      interviews: Number(funnel?.interviews || 0),
      offers: Number(funnel?.offers || 0),
      offersAccepted: Number(funnel?.offersAccepted || 0),
      hired: Number(funnel?.hired || 0)
    };
  
    return json({
      period: { days, since },
      kpis: {
        totalJobs: Number(jobSummary?.totalJobs || 0),
        activeJobs: Number(jobSummary?.activeJobs || 0),
        jobViews: Number(views?.jobViews || 0),
        uniqueViewers: Number(views?.uniqueViewers || 0),
        avgDaysToHire: avgTime?.avgDays === null || avgTime?.avgDays === undefined
          ? null : Number(avgTime.avgDays)
      },
      funnel: f,
      rates: {
        shortlistRate: pct(f.shortlisted, f.applications),
        interviewRate: pct(f.interviews, f.applications),
        offerRate: pct(f.offers, f.applications),
        hireRate: pct(f.hired, f.applications),
        offerAcceptance: pct(f.offersAccepted, f.offers),
        viewToApply: pct(f.applications, views?.jobViews)
      },
      jobs: jobs.map(j => ({
        id: j.id,
        title: j.title,
        status: j.status,
        location: j.location,
        createdAt: j.createdAt,
        applications: Number(j.applications || 0),
        shortlisted: Number(j.shortlisted || 0),
        interviews: Number(j.interviews || 0),
        offers: Number(j.offers || 0),
        hires: Number(j.hires || 0)
      })),
      notes: {
        engagementTracking: "Job-view analytics start from v16."
      }
    }, { headers: { "Cache-Control": "no-store" } });
  }
  return { onRequestGet };
})();

// Source route: verification.js
const route1 = (() => {
  async function onRequestPost(context) {
    const { env } = context;
    const { user, error } = await requireUser(context);
    if (error) return error;
    if (user.role !== "employer") return err("Employer account required", 403);
  
    const profile = await env.DB.prepare(
      `SELECT company_name, legal_name, location, phone, website, registration_number, logo_data,
              verification_status
       FROM employer_profiles WHERE user_id=?`
    ).bind(user.id).first();
  
    if (!profile) return err("Business profile not found", 404);
  
    const missing = [];
    if (!profile.company_name) missing.push("business name");
    if (!profile.legal_name) missing.push("legal business name");
    if (!profile.location) missing.push("business location");
    if (!profile.phone) missing.push("phone number");
    if (!profile.registration_number) missing.push("company/registration number");
  
    if (missing.length) {
      return err("Complete these fields before submitting: " + missing.join(", "), 400);
    }
  
    if (profile.verification_status === "verified") {
      return json({ ok: true, status: "verified" });
    }
  
    await env.DB.prepare(
      `UPDATE employer_profiles
       SET verification_status='pending',
           verification_submitted_at=datetime('now'),
           verification_note=NULL
       WHERE user_id=?`
    ).bind(user.id).run();
  
    return json({ ok: true, status: "pending" });
  }
  return { onRequestPost };
})();

const ROUTES = [
  { segments: ["analytics"], handlers: route0 }, // analytics.js
  { segments: ["verification"], handlers: route1 }, // verification.js
];

function tailParts(context) {
  const raw = context.params?.path;
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (raw === undefined || raw === null || raw === '') return [];
  return String(raw).split('/').filter(Boolean);
}

function matchSegments(pattern, actual) {
  if (pattern.length !== actual.length) return null;
  const params = {};
  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i];
    const a = actual[i];
    const m = /^\[([^\]]+)\]$/.exec(p);
    if (m) params[m[1]] = a;
    else if (p !== a) return null;
  }
  return params;
}

async function dispatch(context, method) {
  const actual = tailParts(context);
  for (const route of ROUTES) {
    const extra = matchSegments(route.segments, actual);
    if (!extra) continue;
    const handler = route.handlers[method];
    if (!handler) return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'content-type': 'application/json; charset=utf-8' } });
    const nextContext = { ...context, params: { ...(context.params || {}), ...extra } };
    return handler(nextContext);
  }
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

export async function onRequestGet(context) { return dispatch(context, "onRequestGet"); }
export async function onRequestPost(context) { return dispatch(context, "onRequestPost"); }
