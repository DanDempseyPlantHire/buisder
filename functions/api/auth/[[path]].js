// Consolidated Pages Functions routes. Generated for Deas Jobs v24.4 compact deployment.
import { recordAnalyticsEvent } from "../../_lib/analytics.js";
import { ensureCommercialAccount } from "../../_lib/commercial.js";
import { clearSessionCookie, err, hashPassword, json, newId, parseCookies, sessionCookie, verifyPassword } from "../../_lib/db.js";
import { getValidGrowthCode, recordGrowthSignup } from "../../_lib/growth.js";
import { getPilotSettings, joinPilotByInvite, validatePilotInvite } from "../../_lib/pilot.js";
import { PRIVACY_VERSION, TERMS_VERSION } from "../../_lib/policy.js";
import { appOrigin, clearRateLimit, clientIp, consumeRateLimit, createAuthToken, emailDeliveryConfigured, emailVerificationRequired, getValidAuthToken, markAuthTokenUsed, passwordProblem, sendEmail, verifyTurnstile } from "../../_lib/security.js";

// Source route: forgot-password.js
const route0 = (() => {
  function setupError(e) {
    const msg = String(e?.message || e || "");
    if (/no such table: (auth_rate_limits|auth_tokens|verified_emails)/i.test(msg)) {
      return "Deas Jobs security database setup is incomplete. Run migration-security-v13.sql in the live D1 database.";
    }
    return null;
  }
  
  async function onRequestPost({ request, env }) {
    try {
      const body = await request.json().catch(() => ({}));
      const cleanEmail = String(body.email || "").toLowerCase().trim();
  
      const ip = clientIp(request);
      const limit = await consumeRateLimit(env, `forgot:${ip}:${cleanEmail}`, 5, 3600);
      if (!limit.allowed) {
        return json({
          ok: true,
          message: "If that account exists, reset instructions will be sent when allowed."
        });
      }
  
      const turnstile = await verifyTurnstile(env, request, body.turnstileToken);
      if (!turnstile.ok) {
        return json({ error: turnstile.error }, { status: 403 });
      }
  
      if (!emailDeliveryConfigured(env)) {
        return json({
          error: "Password-reset email is not configured. Check RESEND_API_KEY and EMAIL_FROM in Cloudflare."
        }, { status: 503 });
      }
  
      if (cleanEmail) {
        const user = await env.DB.prepare(
          "SELECT id, email FROM users WHERE email=? AND is_suspended=0"
        ).bind(cleanEmail).first();
  
        if (user) {
          const token = await createAuthToken(env, user.id, "reset_password", 30 * 60);
          const link = `${appOrigin(env, request)}/login.html?reset=${encodeURIComponent(token)}`;
  
          const sent = await sendEmail(env, {
            to: user.email,
            subject: "Reset your Deas Jobs password",
            html: `<p>We received a request to reset your Deas Jobs password.</p><p><a href="${link}">Reset password</a></p><p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>`,
            text: `Reset your Deas Jobs password: ${link}\nThis link expires in 30 minutes.`
          });
  
          if (!sent.ok) {
            return json({
              error: sent.status
                ? `Password-reset email could not be sent (email provider status ${sent.status}).`
                : "Password-reset email provider could not be reached.",
              detail: sent.detail || null
            }, { status: 502 });
          }
        }
      }
  
      return json({
        ok: true,
        message: "If that account exists, password reset instructions have been sent."
      }, { headers: { "Cache-Control": "no-store" } });
  
    } catch (e) {
      const setup = setupError(e);
      return json({
        error: setup || "Password reset request failed on the server.",
        detail: setup ? undefined : String(e?.message || e)
      }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }
  }
  return { onRequestPost };
})();

// Source route: login.js
const route1 = (() => {
  const SESSION_SECONDS = 7 * 24 * 3600;
  
  async function onRequestPost({ request, env }) {
    const body = await request.json().catch(() => null);
    if (!body) return err("Invalid request body");
  
    const { email, password, turnstileToken } = body;
    if (!email || !password) return err("Email and password are required");
  
    const cleanEmail = String(email).toLowerCase().trim();
    const ip = clientIp(request);
    const rateKey = `login:${ip}:${cleanEmail}`;
  
    const limit = await consumeRateLimit(env, rateKey, 8, 15 * 60);
    if (!limit.allowed) {
      return err("Too many login attempts. Please wait 15 minutes and try again.", 429);
    }
  
    const turnstile = await verifyTurnstile(env, request, turnstileToken);
    if (!turnstile.ok) return err(turnstile.error, 403);
  
    const row = await env.DB.prepare(
      `SELECT u.id, u.email, u.role, u.name, u.password_hash, u.password_salt, u.is_suspended,
              CASE WHEN au.user_id IS NULL THEN 0 ELSE 1 END AS is_admin,
              CASE WHEN ve.user_id IS NULL THEN 0 ELSE 1 END AS email_verified
       FROM users u
       LEFT JOIN admin_users au ON au.user_id = u.id
       LEFT JOIN verified_emails ve ON ve.user_id = u.id
       WHERE u.email = ?`
    ).bind(cleanEmail).first();
  
    if (!row) return err("Incorrect email or password", 401);
    if (row.is_suspended) return err("This account has been suspended", 403);
  
    const ok = await verifyPassword(password, row.password_hash, row.password_salt);
    if (!ok) return err("Incorrect email or password", 401);
  
    if (emailVerificationRequired(env) && !row.email_verified) {
      return json({
        error: "Verify your email before logging in.",
        code: "EMAIL_NOT_VERIFIED",
        email: cleanEmail
      }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
  
    await clearRateLimit(env, rateKey);
  
    const token = newId();
    const expires = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
    await env.DB.prepare(
      "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
    ).bind(token, row.id, expires).run();
  
    return json(
      {
        user: {
          id: row.id,
          email: row.email,
          role: row.role,
          name: row.name,
          isAdmin: Boolean(row.is_admin),
          emailVerified: Boolean(row.email_verified)
        }
      },
      { headers: { "Set-Cookie": sessionCookie(token, SESSION_SECONDS), "Cache-Control": "no-store" } }
    );
  }
  return { onRequestPost };
})();

// Source route: logout.js
const route2 = (() => {
  async function onRequestPost({ request, env }) {
    const { session } = parseCookies(request);
    if (session) {
      await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(session).run();
    }
    return json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
  }
  return { onRequestPost };
})();

// Source route: resend-verification.js
const route3 = (() => {
  async function onRequestPost({ request, env }) {
    const body = await request.json().catch(() => null);
    if (!body) return err("Invalid request body");
  
    const cleanEmail = String(body.email || "").toLowerCase().trim();
    const ip = clientIp(request);
  
    const limit = await consumeRateLimit(env, `resend:${ip}:${cleanEmail}`, 4, 3600);
    if (!limit.allowed) {
      return err("Too many verification email requests. Try again later.", 429);
    }
  
    const turnstile = await verifyTurnstile(env, request, body.turnstileToken);
    if (!turnstile.ok) return err(turnstile.error, 403);
  
    if (!emailDeliveryConfigured(env)) {
      return err("Email delivery is not configured yet.", 503);
    }
  
    const user = await env.DB.prepare(
      `SELECT u.id, u.email,
              CASE WHEN ve.user_id IS NULL THEN 0 ELSE 1 END AS email_verified
       FROM users u
       LEFT JOIN verified_emails ve ON ve.user_id=u.id
       WHERE u.email=?`
    ).bind(cleanEmail).first();
  
    // Generic response avoids confirming whether an email is registered.
    if (!user || user.email_verified) {
      return json({ ok: true, message: "If verification is needed, an email has been sent." });
    }
  
    const token = await createAuthToken(env, user.id, "verify_email", 24 * 3600);
    const link = `${appOrigin(env, request)}/login.html?verify=${encodeURIComponent(token)}`;
  
    await sendEmail(env, {
      to: user.email,
      subject: "Verify your Deas Jobs email",
      html: `<p><a href="${link}">Verify your Deas Jobs email address</a></p><p>This link expires in 24 hours.</p>`,
      text: `Verify your Deas Jobs email: ${link}\nThis link expires in 24 hours.`
    });
  
    return json({ ok: true, message: "If verification is needed, an email has been sent." });
  }
  return { onRequestPost };
})();

// Source route: reset-password.js
const route4 = (() => {
  function setupError(e) {
    const msg = String(e?.message || e || "");
    if (/no such table: (auth_tokens|verified_emails)/i.test(msg)) {
      return "Deas Jobs security database setup is incomplete. Run migration-security-v13.sql in the live D1 database.";
    }
    return null;
  }
  
  async function onRequestPost({ request, env }) {
    try {
      const body = await request.json().catch(() => null);
      if (!body) return err("Invalid request body");
  
      const rawToken = String(body.token || "").trim();
      const password = String(body.password || "");
  
      if (!rawToken) return err("Password reset token is missing.");
  
      const token = await getValidAuthToken(env, rawToken, "reset_password");
      if (!token) {
        return err("This password reset link is invalid or has expired.", 400);
      }
  
      const user = await env.DB.prepare(
        "SELECT id, email FROM users WHERE id=?"
      ).bind(token.user_id).first();
  
      if (!user) return err("Account not found", 404);
  
      const problem = passwordProblem(password, user.email);
      if (problem) return err(problem);
  
      const { hash, salt } = await hashPassword(password);
  
      // D1 batch keeps the account update and token/session changes together.
      await env.DB.batch([
        env.DB.prepare(
          "UPDATE users SET password_hash=?, password_salt=? WHERE id=?"
        ).bind(hash, salt, user.id),
  
        env.DB.prepare(
          "UPDATE auth_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?"
        ).bind(token.id),
  
        env.DB.prepare(
          "UPDATE auth_tokens SET used_at=CURRENT_TIMESTAMP WHERE user_id=? AND used_at IS NULL"
        ).bind(user.id),
  
        env.DB.prepare(
          "INSERT OR IGNORE INTO verified_emails (user_id) VALUES (?)"
        ).bind(user.id),
  
        env.DB.prepare(
          "DELETE FROM sessions WHERE user_id=?"
        ).bind(user.id)
      ]);
  
      return json(
        { ok: true, message: "Password reset. You can now log in." },
        {
          headers: {
            "Set-Cookie": sessionCookie("", 0),
            "Cache-Control": "no-store"
          }
        }
      );
  
    } catch (e) {
      const setup = setupError(e);
      return json({
        error: setup || "Password could not be reset on the server.",
        detail: setup ? undefined : String(e?.message || e)
      }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }
  }
  return { onRequestPost };
})();

// Source route: signup.js
const route5 = (() => {
  const SESSION_SECONDS = 7 * 24 * 3600;
  
  async function onRequestPost({ request, env }) {
    const body = await request.json().catch(() => null);
    if (!body) return err("Invalid request body");
  
    const {
      email, password, role, name, turnstileToken,
      acceptedTerms, acceptedPrivacy, eligibilityConfirmed, pilotInviteCode, referralCode, attribution
    } = body;
    if (!email || !password || !role) return err("Email, password and role are required");
    if (!["jobseeker", "employer"].includes(role)) return err("Role must be jobseeker or employer");
    if (!acceptedTerms || !acceptedPrivacy) {
      return err("You must accept the Deas Jobs Pilot Terms and Privacy Summary to create an account.");
    }
    if (!eligibilityConfirmed) {
      return err(role === "jobseeker"
        ? "Confirm that you are at least 16 years old."
        : "Confirm that you are authorised to use Deas Jobs for this business.");
    }
  
    const cleanEmail = String(email).toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return err("Enter a valid email address");
  
    const passwordError = passwordProblem(password, cleanEmail);
    if (passwordError) return err(passwordError);
  
    const ip = clientIp(request);
    const limit = await consumeRateLimit(env, `signup:${ip}`, 8, 3600);
    if (!limit.allowed) {
      return err("Too many signup attempts. Please try again later.", 429);
    }
  
    const turnstile = await verifyTurnstile(env, request, turnstileToken);
    if (!turnstile.ok) return err(turnstile.error, 403);
  
    let validatedPilotInvite = null;
    try {
      const pilotSettings = await getPilotSettings(env);
      const suppliedInvite = String(pilotInviteCode || "").trim();
      if (Number(pilotSettings.inviteRequired) && !suppliedInvite) {
        return err("A pilot invite code is required to create an account during this pilot.", 403);
      }
      if (suppliedInvite) {
        const checked = await validatePilotInvite(env, suppliedInvite, role);
        if (!checked.ok) return err(checked.error || "Pilot invite code is not valid.", 403);
        validatedPilotInvite = checked.invite;
      }
    } catch (e) {
      // Before v20 migration, do not lock legitimate users out merely because pilot tables are absent.
      if (!/no such table: pilot_/i.test(String(e?.message || e))) throw e;
    }
  
    let validatedGrowthCode = null;
    try {
      const growthCheck = await getValidGrowthCode(env, referralCode, role);
      if (!growthCheck.ok) return err(growthCheck.error, 400);
      validatedGrowthCode = growthCheck.code;
    } catch (e) {
      if (!/no such table: growth_/i.test(String(e?.message || e))) throw e;
    }
  
    const requireVerification = emailVerificationRequired(env);
    if (requireVerification && !emailDeliveryConfigured(env)) {
      return err("Email verification is enabled but email delivery is not configured.", 503);
    }
  
    const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(cleanEmail).first();
    if (existing) return err("An account with that email already exists", 409);
  
    const { hash, salt } = await hashPassword(password);
    const id = newId();
  
    await env.DB.prepare(
      "INSERT INTO users (id, email, password_hash, password_salt, role, name) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(id, cleanEmail, hash, salt, role, name || "").run();
  
    if (role === "jobseeker") {
      await env.DB.prepare("INSERT INTO jobseeker_profiles (user_id) VALUES (?)").bind(id).run();
    } else {
      await env.DB.prepare(
        "INSERT INTO employer_profiles (user_id, company_name) VALUES (?, ?)"
      ).bind(id, name || "").run();
      await ensureCommercialAccount(env, id);
    }
  
    await env.DB.prepare(
      `INSERT INTO legal_consents
       (id, user_id, terms_version, privacy_version)
       VALUES (?, ?, ?, ?)`
    ).bind(newId(), id, TERMS_VERSION, PRIVACY_VERSION).run();
  
    await env.DB.prepare(
      `INSERT OR IGNORE INTO privacy_preferences
       (user_id, share_email, share_cv, share_photo, share_location)
       VALUES (?, 1, 1, 1, 1)`
    ).bind(id).run();
  
    await env.DB.prepare(
      `INSERT OR IGNORE INTO notification_preferences (user_id)
       VALUES (?)`
    ).bind(id).run();
  
    await recordAnalyticsEvent(env, {
      userId: id,
      userRole: role,
      eventType: "user_signup",
      eventKey: `user_signup:${id}`
    });
  
    if (validatedPilotInvite) {
      await joinPilotByInvite(env, { id, role }, validatedPilotInvite.code);
    }
  
    try {
      await recordGrowthSignup(env, {
        userId:id, role,
        referralCode: validatedGrowthCode?.code || referralCode || "",
        attribution: attribution || {}
      });
    } catch (e) {
      // Growth measurement is non-critical and must never turn a valid signup into a failed signup.
    }
  
    if (requireVerification) {
      const token = await createAuthToken(env, id, "verify_email", 24 * 3600);
      const link = `${appOrigin(env, request)}/login.html?verify=${encodeURIComponent(token)}`;
  
      const sent = await sendEmail(env, {
        to: cleanEmail,
        subject: "Verify your Deas Jobs email",
        html: `<p>Welcome to Deas Jobs.</p><p><a href="${link}">Verify your email address</a></p><p>This link expires in 24 hours.</p>`,
        text: `Welcome to Deas Jobs. Verify your email: ${link}\nThis link expires in 24 hours.`
      });
  
      if (!sent.ok) {
        return json({
          ok: true,
          verificationRequired: true,
          email: cleanEmail,
          emailSent: false,
          message: "Account created. Verification email could not be sent; use Resend verification after email delivery is fixed."
        }, { status: 201 });
      }
  
      return json({
        ok: true,
        verificationRequired: true,
        email: cleanEmail,
        emailSent: true
      }, { status: 201 });
    }
  
    await env.DB.prepare(
      "INSERT OR IGNORE INTO verified_emails (user_id) VALUES (?)"
    ).bind(id).run();
  
    const token = newId();
    const expires = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
    await env.DB.prepare(
      "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
    ).bind(token, id, expires).run();
  
    return json(
      { user: { id, email: cleanEmail, role, name: name || "", emailVerified: true } },
      { headers: { "Set-Cookie": sessionCookie(token, SESSION_SECONDS), "Cache-Control": "no-store" } }
    );
  }
  return { onRequestPost };
})();

// Source route: verify-email.js
const route6 = (() => {
  const SESSION_SECONDS = 7 * 24 * 3600;
  
  async function onRequestPost({ request, env }) {
    const body = await request.json().catch(() => null);
    if (!body) return err("Invalid request body");
  
    const token = await getValidAuthToken(env, String(body.token || ""), "verify_email");
    if (!token) return err("This verification link is invalid or has expired.", 400);
  
    const user = await env.DB.prepare(
      `SELECT u.id, u.email, u.role, u.name, u.is_suspended,
              CASE WHEN au.user_id IS NULL THEN 0 ELSE 1 END AS is_admin
       FROM users u
       LEFT JOIN admin_users au ON au.user_id=u.id
       WHERE u.id=?`
    ).bind(token.user_id).first();
  
    if (!user || user.is_suspended) return err("Account is unavailable", 403);
  
    await env.DB.prepare(
      "INSERT OR IGNORE INTO verified_emails (user_id) VALUES (?)"
    ).bind(user.id).run();
    await markAuthTokenUsed(env, token.id);
  
    const session = newId();
    const expires = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
    await env.DB.prepare(
      "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
    ).bind(session, user.id, expires).run();
  
    return json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        isAdmin: Boolean(user.is_admin),
        emailVerified: true
      }
    }, {
      headers: {
        "Set-Cookie": sessionCookie(session, SESSION_SECONDS),
        "Cache-Control": "no-store"
      }
    });
  }
  return { onRequestPost };
})();

const ROUTES = [
  { segments: ["forgot-password"], handlers: route0 }, // forgot-password.js
  { segments: ["login"], handlers: route1 }, // login.js
  { segments: ["logout"], handlers: route2 }, // logout.js
  { segments: ["resend-verification"], handlers: route3 }, // resend-verification.js
  { segments: ["reset-password"], handlers: route4 }, // reset-password.js
  { segments: ["signup"], handlers: route5 }, // signup.js
  { segments: ["verify-email"], handlers: route6 }, // verify-email.js
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

export async function onRequestPost(context) { return dispatch(context, "onRequestPost"); }
