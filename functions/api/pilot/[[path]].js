// Consolidated Pages Functions routes. Generated for Buisder v24.4 compact deployment.
import { createNotification, err, json, newId, requireUser } from "../../_lib/db.js";
import { getPilotMemberSnapshot, getPilotSettings, joinPilotByInvite } from "../../_lib/pilot.js";

// Source route: config.js
const route0 = (() => {
  async function onRequestGet({ env }) {
    try {
      const settings = await getPilotSettings(env);
      return json({
        pilotName: settings.pilotName,
        inviteRequired: Boolean(Number(settings.inviteRequired)),
        status: settings.status
      }, { headers:{ "Cache-Control":"no-store" } });
    } catch {
      return json({ pilotName:"Buisder Pilot", inviteRequired:false, status:"active" }, {
        headers:{ "Cache-Control":"no-store" }
      });
    }
  }
  return { onRequestGet };
})();

// Source route: feedback.js
const route1 = (() => {
  const TYPES = new Set(["onboarding","midpoint","exit","general"]);
  
  function intIn(value, min, max) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isInteger(n) && n >= min && n <= max ? n : NaN;
  }
  
  async function onRequestPost(context) {
    const { request, env } = context;
    const { user, error } = await requireUser(context);
    if (error) return error;
  
    const settings = await getPilotSettings(env);
    if (!Number(settings.feedbackEnabled)) return err("Pilot feedback is currently disabled.", 403);
  
    const membership = await env.DB.prepare(
      "SELECT id FROM pilot_memberships WHERE user_id=?"
    ).bind(user.id).first();
    if (!membership) return err("Join the pilot before submitting pilot feedback.", 403);
  
    const body = await request.json().catch(() => null);
    if (!body) return err("Invalid request body");
  
    const feedbackType = String(body.feedbackType || "general");
    if (!TYPES.has(feedbackType)) return err("Invalid feedback type");
  
    const rating = intIn(body.rating, 1, 5);
    const ease = intIn(body.easeScore, 1, 5);
    const recommend = intIn(body.recommendScore, 0, 10);
    if ([rating,ease,recommend].some(Number.isNaN)) return err("Feedback scores are outside the allowed range.");
  
    const comments = String(body.comments || "").trim().slice(0, 3000);
    if (rating === null && ease === null && recommend === null && !comments) {
      return err("Add a score or comment before submitting feedback.");
    }
  
    const id = newId();
    await env.DB.prepare(
      `INSERT INTO pilot_feedback
       (id, user_id, membership_id, feedback_type, rating, ease_score, recommend_score, comments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, user.id, membership.id, feedbackType, rating, ease, recommend, comments).run();
  
    return json({ ok:true, id }, { status:201 });
  }
  return { onRequestPost };
})();

// Source route: issues.js
const route2 = (() => {
  const CATEGORIES = new Set(["bug","usability","content","notification","account","safety","other"]);
  const SEVERITIES = new Set(["low","medium","high","critical"]);
  
  async function onRequestPost(context) {
    const { request, env } = context;
    const { user, error } = await requireUser(context);
    if (error) return error;
  
    const membership = await env.DB.prepare(
      "SELECT id FROM pilot_memberships WHERE user_id=?"
    ).bind(user.id).first();
    if (!membership) return err("Join the pilot before logging a pilot issue.", 403);
  
    const body = await request.json().catch(() => null);
    if (!body) return err("Invalid request body");
  
    const category = String(body.category || "other");
    const severity = String(body.severity || "medium");
    const title = String(body.title || "").trim().slice(0, 160);
    const details = String(body.details || "").trim().slice(0, 4000);
  
    if (!CATEGORIES.has(category)) return err("Invalid issue category");
    if (!SEVERITIES.has(severity)) return err("Invalid issue severity");
    if (!title) return err("Add a short issue title");
  
    const id = newId();
    await env.DB.prepare(
      `INSERT INTO pilot_issues
       (id, reporter_user_id, membership_id, category, severity, title, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, user.id, membership.id, category, severity, title, details).run();
  
    const { results: admins } = await env.DB.prepare(
      "SELECT user_id AS userId FROM admin_users"
    ).all();
    for (const admin of admins || []) {
      await createNotification(env, {
        userId:admin.userId,
        type:"pilot_issue",
        title:`Pilot issue: ${title}`,
        body:`${severity.toUpperCase()} ${category} issue submitted by a pilot participant.`,
        eventKey:`pilot-issue:${id}:${admin.userId}`
      });
    }
  
    return json({ ok:true, id }, { status:201 });
  }
  return { onRequestPost };
})();

// Source route: join.js
const route3 = (() => {
  async function onRequestPost(context) {
    const { request, env } = context;
    const { user, error } = await requireUser(context);
    if (error) return error;
  
    const body = await request.json().catch(() => null);
    if (!body) return err("Invalid request body");
  
    const joined = await joinPilotByInvite(env, user, body.code);
    if (!joined.ok) return err(joined.error || "Pilot invite could not be applied", 400);
  
    return json({ ok:true, ...(await getPilotMemberSnapshot(env, user.id)) });
  }
  return { onRequestPost };
})();

// Source route: me.js
const route4 = (() => {
  async function onRequestGet(context) {
    const { user, error } = await requireUser(context);
    if (error) return error;
    return json(await getPilotMemberSnapshot(context.env, user.id), {
      headers:{ "Cache-Control":"no-store" }
    });
  }
  return { onRequestGet };
})();

const ROUTES = [
  { segments: ["config"], handlers: route0 }, // config.js
  { segments: ["feedback"], handlers: route1 }, // feedback.js
  { segments: ["issues"], handlers: route2 }, // issues.js
  { segments: ["join"], handlers: route3 }, // join.js
  { segments: ["me"], handlers: route4 }, // me.js
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
