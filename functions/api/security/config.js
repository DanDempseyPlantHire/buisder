import { json } from "../../_lib/db.js";
import { emailDeliveryConfigured, emailVerificationRequired } from "../../_lib/security.js";

export async function onRequestGet({ env }) {
  return json({
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || "",
    turnstileEnabled: Boolean(env.TURNSTILE_SECRET_KEY),
    emailDeliveryConfigured: emailDeliveryConfigured(env),
    emailVerificationRequired: emailVerificationRequired(env)
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}
