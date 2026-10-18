// Consolidated Pages Functions routes. Generated for Buisder v24.4 compact deployment.
import { json } from "../../_lib/db.js";
import { emailDeliveryConfigured, emailVerificationRequired } from "../../_lib/security.js";

// Source route: config.js
const route0 = (() => {
  async function onRequestGet({ env }) {
    return json({
      turnstileSiteKey: String(env.TURNSTILE_SITE_KEY || "").trim(),
      turnstileEnabled: Boolean(env.TURNSTILE_SECRET_KEY),
      emailDeliveryConfigured: emailDeliveryConfigured(env),
      emailVerificationRequired: emailVerificationRequired(env)
    }, {
      headers: { "Cache-Control": "no-store" }
    });
  }
  return { onRequestGet };
})();

// Source route: diagnostic.js
const route1 = (() => {
  async function onRequestGet({ request, env }) {
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
  return { onRequestGet };
})();

const ROUTES = [
  { segments: ["config"], handlers: route0 }, // config.js
  { segments: ["diagnostic"], handlers: route1 }, // diagnostic.js
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
