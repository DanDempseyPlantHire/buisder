import { json, err, newId, verifyPassword, sessionCookie } from "../../_lib/db.js";
import {
  clientIp,
  clearRateLimit,
  consumeRateLimit,
  emailVerificationRequired,
  verifyTurnstile
} from "../../_lib/security.js";

const SESSION_SECONDS = 7 * 24 * 3600;

export async function onRequestPost({ request, env }) {
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
