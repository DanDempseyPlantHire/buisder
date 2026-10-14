import { json } from "../../_lib/db.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  return json({
    ok: true,
    hostname: url.hostname,
    turnstileSiteKeyConfigured: Boolean(String(env.TURNSTILE_SITE_KEY || "").trim()),
    turnstileSecretKeyConfigured: Boolean(String(env.TURNSTILE_SECRET_KEY || "").trim()),
    sameTurnstileConfigurationPresent:
      Boolean(String(env.TURNSTILE_SITE_KEY || "").trim()) && Boolean(String(env.TURNSTILE_SECRET_KEY || "").trim()),
    emailApiConfigured: Boolean(env.RESEND_API_KEY),
    emailFromConfigured: Boolean(env.EMAIL_FROM),
    appUrlConfigured: Boolean(env.APP_URL)
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}
