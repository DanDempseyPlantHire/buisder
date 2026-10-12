import { json, err } from "../../_lib/db.js";
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
  const link = `${appOrigin(env, request)}/?verify=${encodeURIComponent(token)}`;

  await sendEmail(env, {
    to: user.email,
    subject: "Verify your Buisder email",
    html: `<p><a href="${link}">Verify your Buisder email address</a></p><p>This link expires in 24 hours.</p>`,
    text: `Verify your Buisder email: ${link}\nThis link expires in 24 hours.`
  });

  return json({ ok: true, message: "If verification is needed, an email has been sent." });
}
