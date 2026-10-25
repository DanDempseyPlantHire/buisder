// Consolidated Pages Functions routes. Generated for Deas Jobs v24.4 compact deployment.
import { clearSessionCookie, err, json, newId, requireUser, verifyPassword } from "../../_lib/db.js";
import { PRIVACY_VERSION, TERMS_VERSION } from "../../_lib/policy.js";

// Source route: compliance-complaints.js
const route0 = (() => {
  async function onRequestGet(context) {
    const { env } = context;
    const { user, error } = await requireUser(context);
    if (error) return error;
    const { results } = await env.DB.prepare(
      `SELECT id, category, details, status, due_at AS dueAt, admin_response AS adminResponse,
              created_at AS createdAt, resolved_at AS resolvedAt
       FROM compliance_complaints WHERE user_id=? ORDER BY created_at DESC LIMIT 50`
    ).bind(user.id).all();
    return json({ complaints: results || [] });
  }
  
  async function onRequestPost(context) {
    const { request, env } = context;
    const { user, error } = await requireUser(context);
    if (error) return error;
    const body = await request.json().catch(() => null);
    const category = String(body?.category || "privacy").trim().slice(0,80);
    const details = String(body?.details || "").trim().slice(0,4000);
    if (details.length < 10) return err("Add a short description of the complaint.");
    const id = newId();
    await env.DB.prepare(
      `INSERT INTO compliance_complaints (id,user_id,requestor_email,category,details)
       VALUES (?,?,?,?,?)`
    ).bind(id,user.id,user.email,category,details).run();
    return json({ ok:true, id }, { status:201 });
  }
  return { onRequestGet, onRequestPost };
})();

// Source route: consent.js
const route1 = (() => {
  async function onRequestPost(context) {
    const { request, env } = context;
    const { user, error } = await requireUser(context);
    if (error) return error;
  
    const body = await request.json().catch(() => null);
    if (!body?.accepted) return err("Acceptance is required");
  
    await env.DB.prepare(
      `INSERT OR IGNORE INTO legal_consents
       (id, user_id, terms_version, privacy_version)
       VALUES (?, ?, ?, ?)`
    ).bind(newId(), user.id, TERMS_VERSION, PRIVACY_VERSION).run();
  
    return json({
      ok: true,
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION
    });
  }
  return { onRequestPost };
})();

// Source route: data-rights.js
const route2 = (() => {
  const TYPES = new Set(["access","rectification","erasure","restriction","objection","portability","other"]);
  
  async function onRequestGet(context) {
    const { env } = context;
    const { user, error } = await requireUser(context);
    if (error) return error;
    const { results } = await env.DB.prepare(
      `SELECT id, request_type AS requestType, details, status, due_at AS dueAt,
              admin_response AS adminResponse, created_at AS createdAt, completed_at AS completedAt
       FROM data_rights_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 50`
    ).bind(user.id).all();
    return json({ requests: results || [] });
  }
  
  async function onRequestPost(context) {
    const { request, env } = context;
    const { user, error } = await requireUser(context);
    if (error) return error;
    const body = await request.json().catch(() => null);
    const requestType = String(body?.requestType || "");
    const details = String(body?.details || "").trim().slice(0, 4000);
    if (!TYPES.has(requestType)) return err("Choose a valid data protection request type");
    const duplicate = await env.DB.prepare(
      `SELECT id FROM data_rights_requests WHERE user_id=? AND request_type=? AND status IN ('open','in_progress') LIMIT 1`
    ).bind(user.id, requestType).first();
    if (duplicate) return err("You already have an open request of this type.", 409);
    const id = newId();
    await env.DB.prepare(
      `INSERT INTO data_rights_requests (id,user_id,requestor_email,request_type,details)
       VALUES (?,?,?,?,?)`
    ).bind(id,user.id,user.email,requestType,details).run();
    return json({ ok:true, id }, { status:201 });
  }
  return { onRequestGet, onRequestPost };
})();

// Source route: delete.js
const route3 = (() => {
  async function onRequestPost(context) {
    const { request, env } = context;
    const { user, error } = await requireUser(context);
    if (error) return error;
  
    if (user.isAdmin) {
      return err("Admin accounts cannot be deleted through self-service.", 403);
    }
  
    const body = await request.json().catch(() => null);
    if (!body) return err("Invalid request body");
    if (String(body.confirm || "") !== "DELETE") {
      return err('Type DELETE to confirm permanent account deletion.');
    }
  
    const account = await env.DB.prepare(
      "SELECT password_hash, password_salt FROM users WHERE id=?"
    ).bind(user.id).first();
    if (!account) return err("Account not found", 404);
  
    const passwordOk = await verifyPassword(
      String(body.password || ""),
      account.password_hash,
      account.password_salt
    );
    if (!passwordOk) return err("Password is incorrect", 401);
  
  
    const keys = [];
  
    if (user.role === "jobseeker") {
      const p = await env.DB.prepare(
        "SELECT photo_key, cv_key FROM jobseeker_profiles WHERE user_id=?"
      ).bind(user.id).first();
      if (p?.photo_key) keys.push(p.photo_key);
      if (p?.cv_key) keys.push(p.cv_key);
    } else {
      const p = await env.DB.prepare(
        "SELECT logo_key FROM employer_profiles WHERE user_id=?"
      ).bind(user.id).first();
      if (p?.logo_key) keys.push(p.logo_key);
    }
  
    if (keys.length && env.FILES) {
      try {
        for (const key of keys) await env.FILES.delete(key);
      } catch {
        return err("Stored files could not be deleted. Account deletion was stopped; try again.", 500);
      }
    }
  
    // Preserve moderation reports without retaining the deleting user's identity.
    await env.DB.prepare(
      "UPDATE safety_reports SET reporter_user_id=NULL WHERE reporter_user_id=?"
    ).bind(user.id).run();
    await env.DB.prepare(
      "UPDATE safety_reports SET target_user_id=NULL WHERE target_user_id=?"
    ).bind(user.id).run();
  
    // Cascading foreign keys remove profile, sessions, applications/jobs,
    // auth records, preferences, blocks and consent rows.
    await env.DB.prepare("DELETE FROM users WHERE id=?").bind(user.id).run();
  
    return json(
      { ok: true },
      {
        headers: {
          "Set-Cookie": clearSessionCookie(),
          "Cache-Control": "no-store"
        }
      }
    );
  }
  return { onRequestPost };
})();

// Source route: export.js
const route4 = (() => {
  async function all(env, sql, ...args) {
    const stmt = env.DB.prepare(sql).bind(...args);
    const { results } = await stmt.all();
    return results || [];
  }
  
  async function onRequestGet(context) {
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
  
    const dataRightsRequests = await all(
      env,
      `SELECT request_type AS requestType, details, status, due_at AS dueAt,
              admin_response AS adminResponse, created_at AS createdAt, completed_at AS completedAt
       FROM data_rights_requests WHERE user_id=? ORDER BY created_at DESC`,
      user.id
    );
  
    const complianceComplaints = await all(
      env,
      `SELECT category, details, status, due_at AS dueAt, admin_response AS adminResponse,
              created_at AS createdAt, resolved_at AS resolvedAt
       FROM compliance_complaints WHERE user_id=? ORDER BY created_at DESC`,
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
  
    const pilotMembership = await env.DB.prepare(
      `SELECT pm.status, pm.source, pm.joined_at AS joinedAt,
              pc.name AS cohortName, po.name AS organizationName
       FROM pilot_memberships pm
       LEFT JOIN pilot_cohorts pc ON pc.id=pm.cohort_id
       LEFT JOIN pilot_organizations po ON po.id=pm.organization_id
       WHERE pm.user_id=?`
    ).bind(user.id).first().catch(() => null);
  
    const pilotFeedback = await all(
      env,
      `SELECT feedback_type AS feedbackType, rating, ease_score AS easeScore,
              recommend_score AS recommendScore, comments, created_at AS createdAt
       FROM pilot_feedback WHERE user_id=? ORDER BY created_at DESC`,
      user.id
    ).catch(() => []);
  
    const pilotIssues = await all(
      env,
      `SELECT category, severity, title, details, status, admin_note AS adminNote,
              created_at AS createdAt, updated_at AS updatedAt
       FROM pilot_issues WHERE reporter_user_id=? ORDER BY created_at DESC`,
      user.id
    ).catch(() => []);
  
    const notificationPreferences = await env.DB.prepare(
      `SELECT recruitment_emails AS recruitmentEmails,
              application_updates AS applicationUpdates, interviews,
              interview_reminders AS interviewReminders, offers, outcomes,
              updated_at AS updatedAt
       FROM notification_preferences WHERE user_id=?`
    ).bind(user.id).first();
  
    const recruitmentEmailHistory = await all(
      env,
      `SELECT event_type AS eventType, status, attempt_count AS attemptCount,
              sent_at AS sentAt, last_attempt_at AS lastAttemptAt,
              created_at AS createdAt
       FROM email_delivery_log
       WHERE user_id=?
       ORDER BY created_at DESC`,
      user.id
    );
  
    const growthAttribution = await env.DB.prepare(
      `SELECT grc.code AS referralCode, gp.name AS partnerName, gc.name AS campaignName,
              ga.first_utm_source AS firstUtmSource, ga.first_utm_medium AS firstUtmMedium,
              ga.first_utm_campaign AS firstUtmCampaign, ga.first_utm_content AS firstUtmContent,
              ga.first_utm_term AS firstUtmTerm, ga.landing_path AS landingPath, ga.created_at AS createdAt
       FROM growth_attribution ga
       LEFT JOIN growth_referral_codes grc ON grc.id=ga.referral_code_id
       LEFT JOIN growth_partners gp ON gp.id=ga.partner_id
       LEFT JOIN growth_campaigns gc ON gc.id=ga.campaign_id
       WHERE ga.user_id=?`
    ).bind(user.id).first().catch(() => null);
  
    const growthReferralCodes = await all(
      env,
      `SELECT code, referral_type AS referralType, target_role AS targetRole, status,
              max_uses AS maxUses, use_count AS useCount, expires_at AS expiresAt, created_at AS createdAt
       FROM growth_referral_codes WHERE owner_user_id=? ORDER BY created_at DESC`,
      user.id
    ).catch(() => []);
  
    const growthReferralsMade = await all(
      env,
      `SELECT gr.target_role AS targetRole, gr.created_at AS createdAt
       FROM growth_referrals gr WHERE gr.referrer_user_id=? ORDER BY gr.created_at DESC`,
      user.id
    ).catch(() => []);
  
    const applicationMessages = await all(
      env,
      `SELECT am.application_id AS applicationId,am.sender_user_id AS senderUserId,am.body,
              am.read_at AS readAt,am.created_at AS createdAt
       FROM application_messages am
       JOIN applications a ON a.id=am.application_id
       JOIN jobs j ON j.id=a.job_id
       WHERE a.jobseeker_id=? OR j.employer_id=?
       ORDER BY am.created_at DESC`,
      user.id,user.id
    ).catch(() => []);
  
    const pushPreference = await env.DB.prepare(
      `SELECT enabled,updated_at AS updatedAt FROM push_preferences WHERE user_id=?`
    ).bind(user.id).first().catch(() => null);
  
    const exportData = {
      generatedAt: new Date().toISOString(),
      account,
      privacy: privacy || null,
      legalConsents: consents,
      notifications,
      reportsSubmitted,
      blocks,
      dataRightsRequests,
      complianceComplaints,
      analyticsEvents,
      pilot: { membership: pilotMembership || null, feedback: pilotFeedback, issues: pilotIssues },
      notificationPreferences: notificationPreferences || null,
      recruitmentEmailHistory,
      applicationMessages,
      pushPreference: pushPreference || null,
      growth:{ attribution:growthAttribution || null, referralCodes:growthReferralCodes, referralsMade:growthReferralsMade }
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
  
      exportData.commercialAccount = await env.DB.prepare(
        `SELECT plan_code AS planCode, status, source, started_at AS startedAt,
                access_ends_at AS accessEndsAt, updated_at AS updatedAt
         FROM employer_commercial_accounts WHERE employer_id=?`
      ).bind(user.id).first();
  
      exportData.commercialHistory = await all(
        env,
        `SELECT event_type AS eventType, plan_code AS planCode, description,
                created_at AS createdAt
         FROM commercial_history WHERE employer_id=? ORDER BY created_at DESC`,
        user.id
      );
  
      exportData.planRequests = await all(
        env,
        `SELECT requested_plan_code AS requestedPlanCode, message, status,
                admin_note AS adminNote, created_at AS createdAt, reviewed_at AS reviewedAt
         FROM commercial_plan_requests WHERE employer_id=? ORDER BY created_at DESC`,
        user.id
      );
  
      exportData.referral = await env.DB.prepare(
        `SELECT code FROM employer_referral_codes WHERE employer_id=?`
      ).bind(user.id).first();
  
  
      exportData.integrationApiKeys = await all(env,
        `SELECT name,token_prefix AS tokenPrefix,status,last_used_at AS lastUsedAt,created_at AS createdAt,revoked_at AS revokedAt
         FROM integration_api_keys WHERE employer_id=? ORDER BY created_at DESC`,user.id).catch(() => []);
  
      exportData.integrationJobLinks = await all(env,
        `SELECT external_job_id AS externalJobId,job_id AS jobId,created_at AS createdAt,updated_at AS updatedAt
         FROM integration_job_links WHERE employer_id=? ORDER BY created_at DESC`,user.id).catch(() => []);
  
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
        "Content-Disposition": `attachment; filename="deasjobs-data-export-${date}.json"`,
        "Cache-Control": "no-store"
      }
    });
  }
  return { onRequestGet };
})();

// Source route: notification-preferences.js
const route5 = (() => {
  function flag(value) {
    return value === true || value === 1 || value === "1";
  }
  
  async function onRequestGet(context) {
    const { env } = context;
    const { user, error } = await requireUser(context);
    if (error) return error;
  
    const row = await env.DB.prepare(
      `SELECT recruitment_emails AS recruitmentEmails,
              application_updates AS applicationUpdates,
              interviews,
              interview_reminders AS interviewReminders,
              offers,
              outcomes,
              updated_at AS updatedAt
       FROM notification_preferences WHERE user_id=?`
    ).bind(user.id).first();
  
    return json({
      preferences: row || {
        recruitmentEmails:1,
        applicationUpdates:1,
        interviews:1,
        interviewReminders:1,
        offers:1,
        outcomes:1,
        updatedAt:null
      }
    }, { headers:{ "Cache-Control":"no-store" } });
  }
  
  async function onRequestPut(context) {
    const { request, env } = context;
    const { user, error } = await requireUser(context);
    if (error) return error;
  
    const body = await request.json().catch(() => null);
    if (!body) return err("Invalid request body");
  
    const values = {
      recruitmentEmails:flag(body.recruitmentEmails),
      applicationUpdates:flag(body.applicationUpdates),
      interviews:flag(body.interviews),
      interviewReminders:flag(body.interviewReminders),
      offers:flag(body.offers),
      outcomes:flag(body.outcomes)
    };
  
    await env.DB.prepare(
      `INSERT INTO notification_preferences
       (user_id, recruitment_emails, application_updates, interviews,
        interview_reminders, offers, outcomes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         recruitment_emails=excluded.recruitment_emails,
         application_updates=excluded.application_updates,
         interviews=excluded.interviews,
         interview_reminders=excluded.interview_reminders,
         offers=excluded.offers,
         outcomes=excluded.outcomes,
         updated_at=CURRENT_TIMESTAMP`
    ).bind(
      user.id,
      values.recruitmentEmails ? 1 : 0,
      values.applicationUpdates ? 1 : 0,
      values.interviews ? 1 : 0,
      values.interviewReminders ? 1 : 0,
      values.offers ? 1 : 0,
      values.outcomes ? 1 : 0
    ).run();
  
    return json({ ok:true, preferences:values });
  }
  return { onRequestGet, onRequestPut };
})();

// Source route: privacy.js
const route6 = (() => {
  function flag(value) {
    return value === true || value === 1 || value === "1";
  }
  
  async function onRequestPut(context) {
    const { request, env } = context;
    const { user, error } = await requireUser(context);
    if (error) return error;
  
    const body = await request.json().catch(() => null);
    if (!body) return err("Invalid request body");
  
    let shareEmail = flag(body.shareEmail) ? 1 : 0;
    let shareCv = flag(body.shareCv) ? 1 : 0;
    let sharePhoto = flag(body.sharePhoto) ? 1 : 0;
    const shareLocation = flag(body.shareLocation) ? 1 : 0;
  
    // Extra default protection for 16–17-year-old job seekers.
    // They can still use the in-app interview/offer workflow without exposing
    // direct email, profile photo or CV to employers.
    if (user.role === "jobseeker") {
      const profile = await env.DB.prepare(
        "SELECT age_band FROM jobseeker_profiles WHERE user_id=?"
      ).bind(user.id).first();
  
      if (profile?.age_band === "16–17") {
        shareEmail = 0;
        shareCv = 0;
        sharePhoto = 0;
      }
    }
  
    await env.DB.prepare(
      `INSERT INTO privacy_preferences
       (user_id, share_email, share_cv, share_photo, share_location, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         share_email=excluded.share_email,
         share_cv=excluded.share_cv,
         share_photo=excluded.share_photo,
         share_location=excluded.share_location,
         updated_at=CURRENT_TIMESTAMP`
    ).bind(user.id, shareEmail, shareCv, sharePhoto, shareLocation).run();
  
    return json({
      ok: true,
      privacy: {
        shareEmail: Boolean(shareEmail),
        shareCv: Boolean(shareCv),
        sharePhoto: Boolean(sharePhoto),
        shareLocation: Boolean(shareLocation)
      }
    });
  }
  return { onRequestPut };
})();

const ROUTES = [
  { segments: ["compliance-complaints"], handlers: route0 }, // compliance-complaints.js
  { segments: ["consent"], handlers: route1 }, // consent.js
  { segments: ["data-rights"], handlers: route2 }, // data-rights.js
  { segments: ["delete"], handlers: route3 }, // delete.js
  { segments: ["export"], handlers: route4 }, // export.js
  { segments: ["notification-preferences"], handlers: route5 }, // notification-preferences.js
  { segments: ["privacy"], handlers: route6 }, // privacy.js
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
export async function onRequestPut(context) { return dispatch(context, "onRequestPut"); }
