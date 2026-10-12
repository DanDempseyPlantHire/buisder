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

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const cleanEmail = String(body.email || "").toLowerCase().trim();

  const ip = clientIp(request);
  const limit = await consumeRateLimit(env, `forgot:${ip}:${cleanEmail}`, 5, 3600);
  if (!limit.allowed) {
    return json({ ok: true, message: "If that account exists, reset instructions will be sent when allowed." });
  }

  const turnstile = await verifyTurnstile(env, request, body.turnstileToken);
  if (!turnstile.ok) {
    return json({ error: turnstile.error }, { status: 403 });
  }

  if (cleanEmail && emailDeliveryConfigured(env)) {
    const user = await env.DB.prepare(
      "SELECT id, email FROM users WHERE email=? AND is_suspended=0"
    ).bind(cleanEmail).first();

    if (user) {
      const token = await createAuthToken(env, user.id, "reset_password", 30 * 60);
      const link = `${appOrigin(env, request)}/?reset=${encodeURIComponent(token)}`;

      await sendEmail(env, {
        to: user.email,
        subject: "Reset your Buisder password",
        html: `<p>We received a request to reset your Buisder password.</p><p><a href="${link}">Reset password</a></p><p>This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>`,
        text: `Reset your Buisder password: ${link}\nThis link expires in 30 minutes.`
      });
    }
  }

  return json({
    ok: true,
    emailDeliveryConfigured: emailDeliveryConfigured(env),
    message: "If that account exists, password reset instructions have been sent."
  }, { headers: { "Cache-Control": "no-store" } });
}
