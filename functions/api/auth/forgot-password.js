import { json } from "../../_lib/db.js";
import {
  appOrigin,
  clientIp,
  consumeRateLimit,
  createAuthToken,
  emailDeliveryConfigured,
  sendEmail,
  verifyTurnstile
} from "../../_lib/security.js";

function setupError(e) {
  const msg = String(e?.message || e || "");
  if (/no such table: (auth_rate_limits|auth_tokens|verified_emails)/i.test(msg)) {
    return "Buisder security database setup is incomplete. Run migration-security-v13.sql in the live D1 database.";
  }
  return null;
}

export async function onRequestPost({ request, env }) {
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
        const link = `${appOrigin(env, request)}/?reset=${encodeURIComponent(token)}`;

        const sent = await sendEmail(env, {
          to: user.email,
          subject: "Reset your Buisder password",
          html: `<p>We received a request to reset your Buisder password.</p><p><a href="${link}">Reset password</a></p><p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>`,
          text: `Reset your Buisder password: ${link}\nThis link expires in 30 minutes.`
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
