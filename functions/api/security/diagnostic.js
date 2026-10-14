import { json } from "../../_lib/db.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  let dbConnected = false;
  let tables = {};
  let dbError = null;

  try {
    await env.DB.prepare("SELECT 1 AS ok").first();
    dbConnected = true;

    const names = ["users", "sessions", "verified_emails", "auth_tokens", "auth_rate_limits"];
    for (const name of names) {
      const row = await env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
      ).bind(name).first();
      tables[name] = Boolean(row);
    }
  } catch (e) {
    dbError = String(e?.message || e);
  }

  const siteKey = String(env.TURNSTILE_SITE_KEY || "").trim();
  const secretKey = String(env.TURNSTILE_SECRET_KEY || "").trim();
  const resendKey = String(env.RESEND_API_KEY || "").trim();
  const emailFrom = String(env.EMAIL_FROM || "").trim();
  const appUrl = String(env.APP_URL || "").trim();

  const securityMigrationReady =
    Boolean(tables.verified_emails) &&
    Boolean(tables.auth_tokens) &&
    Boolean(tables.auth_rate_limits);

  return json({
    ok: true,
    hostname: url.hostname,
    dbConnected,
    securityMigrationReady,
    tables,
    dbError,
    turnstileSiteKeyConfigured: Boolean(siteKey),
    turnstileSecretKeyConfigured: Boolean(secretKey),
    sameTurnstileConfigurationPresent: Boolean(siteKey && secretKey),
    emailApiConfigured: Boolean(resendKey),
    emailFromConfigured: Boolean(emailFrom),
    appUrlConfigured: Boolean(appUrl),
    emailVerificationRequired:
      String(env.EMAIL_VERIFICATION_REQUIRED || "").trim().toLowerCase() === "true"
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}
