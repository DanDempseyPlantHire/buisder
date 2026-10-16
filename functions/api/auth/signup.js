import { json, err, newId, hashPassword, sessionCookie } from "../../_lib/db.js";
import { TERMS_VERSION, PRIVACY_VERSION } from "../../_lib/policy.js";
import { recordAnalyticsEvent } from "../../_lib/analytics.js";
import { ensureCommercialAccount } from "../../_lib/commercial.js";
import {
  appOrigin,
  clientIp,
  consumeRateLimit,
  createAuthToken,
  emailDeliveryConfigured,
  emailVerificationRequired,
  passwordProblem,
  sendEmail,
  verifyTurnstile
} from "../../_lib/security.js";

const SESSION_SECONDS = 7 * 24 * 3600;

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body) return err("Invalid request body");

  const {
    email, password, role, name, turnstileToken,
    acceptedTerms, acceptedPrivacy, eligibilityConfirmed
  } = body;
  if (!email || !password || !role) return err("Email, password and role are required");
  if (!["jobseeker", "employer"].includes(role)) return err("Role must be jobseeker or employer");
  if (!acceptedTerms || !acceptedPrivacy) {
    return err("You must accept the Buisder Pilot Terms and Privacy Summary to create an account.");
  }
  if (!eligibilityConfirmed) {
    return err(role === "jobseeker"
      ? "Confirm that you are at least 16 years old."
      : "Confirm that you are authorised to use Buisder for this business.");
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

  await recordAnalyticsEvent(env, {
    userId: id,
    userRole: role,
    eventType: "user_signup",
    eventKey: `user_signup:${id}`
  });

  if (requireVerification) {
    const token = await createAuthToken(env, id, "verify_email", 24 * 3600);
    const link = `${appOrigin(env, request)}/?verify=${encodeURIComponent(token)}`;

    const sent = await sendEmail(env, {
      to: cleanEmail,
      subject: "Verify your Buisder email",
      html: `<p>Welcome to Buisder.</p><p><a href="${link}">Verify your email address</a></p><p>This link expires in 24 hours.</p>`,
      text: `Welcome to Buisder. Verify your email: ${link}\nThis link expires in 24 hours.`
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
