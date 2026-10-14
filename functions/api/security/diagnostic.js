import { json } from "../../_lib/db.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  return json({
    ok: true,
    hostname: url.hostname,
    turnstileSiteKeyConfigured: Boolean(env.TURNSTILE_SITE_KEY),
    turnstileSecretKeyConfigured: Boolean(env.TURNSTILE_SECRET_KEY),
    sameTurnstileConfigurationPresent:
      Boolean(env.TURNSTILE_SITE_KEY) && Boolean(env.TURNSTILE_SECRET_KEY),
    emailApiConfigured: Boolean(env.RESEND_API_KEY),
    emailFromConfigured: Boolean(env.EMAIL_FROM),
    appUrlConfigured: Boolean(env.APP_URL)
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}
