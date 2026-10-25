// Consolidated Pages Functions routes. Generated for Deas Jobs v24.4 compact deployment.
import { createNotification, err, json, newId, requireUser } from "../../_lib/db.js";
import { sendRecruitmentEmail } from "../../_lib/email-notifications.js";

// Source route: [userId].js
const route0 = (() => {
  async function onRequestDelete(context) {
    const { env, params } = context;
    const { user, error } = await requireUser(context);
    if (error) return error;
  
    const result = await env.DB.prepare(
      "DELETE FROM user_blocks WHERE blocker_user_id=? AND blocked_user_id=?"
    ).bind(user.id, params.userId).run();
  
    if (!result.meta?.changes) return err("Block not found", 404);
    return json({ ok: true });
  }
  return { onRequestDelete };
})();

// Source route: index.js
const route1 = (() => {
  const FINAL = new Set(["hired","unsuccessful","withdrawn"]);
  
  async function onRequestPost(context) {
    const { request, env } = context;
    const { user, error } = await requireUser(context);
    if (error) return error;
  
    const body = await request.json().catch(() => null);
    if (!body) return err("Invalid request body");
  
    const blockedUserId = String(body.blockedUserId || "");
    if (!blockedUserId) return err("blockedUserId is required");
    if (blockedUserId === user.id) return err("You cannot block yourself");
  
    const target = await env.DB.prepare(
      "SELECT id, role, name FROM users WHERE id=?"
    ).bind(blockedUserId).first();
    if (!target) return err("User not found", 404);
  
    if (user.role === "jobseeker" && target.role !== "employer") {
      return err("Job seekers can block employers from this workflow.");
    }
  
    if (user.role === "employer" && target.role !== "jobseeker") {
      return err("Employers can block applicants from this workflow.");
    }
  
    if (user.role === "employer") {
      const relationship = await env.DB.prepare(
        `SELECT a.id, a.status
         FROM applications a
         JOIN jobs j ON j.id=a.job_id
         WHERE a.jobseeker_id=? AND j.employer_id=?
         ORDER BY a.created_at DESC LIMIT 1`
      ).bind(blockedUserId, user.id).first();
  
      if (!relationship) return err("This person has not applied to one of your jobs.", 403);
      if (["offer_accepted","hired"].includes(relationship.status)) {
        return err("Resolve the accepted/hired employment outcome before blocking this candidate.");
      }
    }
  
    if (user.role === "jobseeker") {
      const accepted = await env.DB.prepare(
        `SELECT a.id
         FROM applications a
         JOIN jobs j ON j.id=a.job_id
         WHERE a.jobseeker_id=? AND j.employer_id=?
           AND a.status IN ('offer_accepted','hired')
         LIMIT 1`
      ).bind(user.id, blockedUserId).first();
  
      if (accepted) {
        return err("Resolve the accepted/hired employment outcome before blocking this employer.");
      }
    }
  
    await env.DB.prepare(
      `INSERT OR IGNORE INTO user_blocks
       (id, blocker_user_id, blocked_user_id)
       VALUES (?, ?, ?)`
    ).bind(newId(), user.id, blockedUserId).run();
  
    // Close active applications without exposing the fact that a block occurred.
    if (user.role === "jobseeker") {
      const { results: apps } = await env.DB.prepare(
        `SELECT a.id, a.status, a.job_id AS jobId, j.employer_id AS employerId, j.title
         FROM applications a
         JOIN jobs j ON j.id=a.job_id
         WHERE a.jobseeker_id=? AND j.employer_id=?`
      ).bind(user.id, blockedUserId).all();
  
      for (const app of apps || []) {
        if (FINAL.has(app.status)) continue;
  
        await env.DB.prepare(
          "UPDATE applications SET status='withdrawn', updated_at=datetime('now') WHERE id=?"
        ).bind(app.id).run();
  
        await env.DB.prepare(
          `UPDATE interview_invites
           SET status='declined', seen_at=COALESCE(seen_at, datetime('now')),
               updated_at=datetime('now')
           WHERE application_id=? AND status='pending'`
        ).bind(app.id).run();
  
        await env.DB.prepare(
          `UPDATE job_offers
           SET status='declined', responded_at=COALESCE(responded_at, CURRENT_TIMESTAMP),
               updated_at=CURRENT_TIMESTAMP
           WHERE application_id=? AND status='pending'`
        ).bind(app.id).run();
  
        await env.DB.prepare(
          `INSERT INTO application_status_history
           (id, application_id, status, actor_user_id, note)
           VALUES (?, ?, 'withdrawn', ?, 'Application withdrawn by candidate')`
        ).bind(newId(), app.id, user.id).run();
  
        await createNotification(env, {
          userId: app.employerId,
          type: "application_withdrawn",
          title: "Application withdrawn",
          body: `${user.name || "A candidate"} withdrew their application for ${app.title}.`,
          applicationId: app.id,
          jobId: app.jobId,
          eventKey: `block-withdraw:${app.id}`
        });
  
        await sendRecruitmentEmail(env, request, {
          userId:app.employerId, category:"application", eventType:"application_withdrawn",
          eventKey:`email:block-withdraw:${app.id}`,
          subject:`Application withdrawn: ${app.title}`,
          heading:"Application withdrawn",
          body:`${user.name || "A candidate"} withdrew their application for ${app.title}.`,
          applicationId:app.id, jobId:app.jobId
        });
      }
    } else {
      const { results: apps } = await env.DB.prepare(
        `SELECT a.id, a.status, a.job_id AS jobId, j.title
         FROM applications a
         JOIN jobs j ON j.id=a.job_id
         WHERE a.jobseeker_id=? AND j.employer_id=?`
      ).bind(blockedUserId, user.id).all();
  
      for (const app of apps || []) {
        if (FINAL.has(app.status)) continue;
  
        await env.DB.prepare(
          "UPDATE applications SET status='unsuccessful', updated_at=datetime('now') WHERE id=?"
        ).bind(app.id).run();
  
        await env.DB.prepare(
          `UPDATE interview_invites
           SET status='declined', seen_at=COALESCE(seen_at, datetime('now')),
               updated_at=datetime('now')
           WHERE application_id=? AND status='pending'`
        ).bind(app.id).run();
  
        await env.DB.prepare(
          `UPDATE job_offers
           SET status='declined', responded_at=COALESCE(responded_at, CURRENT_TIMESTAMP),
               updated_at=CURRENT_TIMESTAMP
           WHERE application_id=? AND status='pending'`
        ).bind(app.id).run();
  
        await env.DB.prepare(
          `INSERT INTO application_status_history
           (id, application_id, status, actor_user_id, note)
           VALUES (?, ?, 'unsuccessful', ?, 'Application closed by employer')`
        ).bind(newId(), app.id, user.id).run();
  
        await createNotification(env, {
          userId: blockedUserId,
          type: "unsuccessful",
          title: "Application update",
          body: `Your application for ${app.title} has been closed.`,
          applicationId: app.id,
          jobId: app.jobId,
          eventKey: `block-close:${app.id}`
        });
  
        await sendRecruitmentEmail(env, request, {
          userId:blockedUserId, category:"outcome", eventType:"unsuccessful",
          eventKey:`email:block-close:${app.id}`,
          subject:`Application update: ${app.title}`,
          heading:"Application outcome",
          body:`Your application for ${app.title} has been closed.`,
          applicationId:app.id, jobId:app.jobId
        });
      }
    }
  
    return json({ ok: true });
  }
  return { onRequestPost };
})();

const ROUTES = [
  { segments: ["[userId]"], handlers: route0 }, // [userId].js
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
