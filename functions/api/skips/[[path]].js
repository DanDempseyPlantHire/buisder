// Consolidated Pages Functions routes. Generated for Deas Jobs v24.4 compact deployment.
import { recordAnalyticsEvent } from "../../_lib/analytics.js";
import { err, json, requireUser } from "../../_lib/db.js";

// Source route: [jobId].js
const route0 = (() => {
  async function onRequestDelete(context) {
    const { env, params } = context;
    const { user, error } = await requireUser(context, "jobseeker");
    if (error) return error;
  
    await env.DB.prepare("DELETE FROM skips WHERE job_id = ? AND jobseeker_id = ?")
      .bind(params.jobId, user.id).run();
    return json({ ok: true });
  }
  return { onRequestDelete };
})();

// Source route: index.js
const route1 = (() => {
  async function onRequestPost(context) {
    const { request, env } = context;
    const { user, error } = await requireUser(context, "jobseeker");
    if (error) return error;
  
    const body = await request.json().catch(() => null);
    const jobId = body && body.jobId;
    if (!jobId) return err("jobId is required");
  
    await env.DB.prepare("INSERT OR IGNORE INTO skips (jobseeker_id, job_id) VALUES (?, ?)")
      .bind(user.id, jobId).run();
  
    await recordAnalyticsEvent(env, {
      userId: user.id,
      userRole: "jobseeker",
      eventType: "job_skip",
      jobId,
      eventKey: `job_skip:${user.id}:${jobId}`
    });
  
    return json({ ok: true }, { status: 201 });
  }
  return { onRequestPost };
})();

const ROUTES = [
  { segments: ["[jobId]"], handlers: route0 }, // [jobId].js
  { segments: [], handlers: route1 }, // index.js
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

export async function onRequestDelete(context) { return dispatch(context, "onRequestDelete"); }
export async function onRequestPost(context) { return dispatch(context, "onRequestPost"); }
