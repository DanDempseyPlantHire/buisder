import { json, err, newId, sessionCookie } from "../../_lib/db.js";
import { getValidAuthToken, markAuthTokenUsed } from "../../_lib/security.js";

const SESSION_SECONDS = 7 * 24 * 3600;

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body) return err("Invalid request body");

  const token = await getValidAuthToken(env, String(body.token || ""), "verify_email");
  if (!token) return err("This verification link is invalid or has expired.", 400);

  const user = await env.DB.prepare(
    `SELECT u.id, u.email, u.role, u.name, u.is_suspended,
            CASE WHEN au.user_id IS NULL THEN 0 ELSE 1 END AS is_admin
     FROM users u
     LEFT JOIN admin_users au ON au.user_id=u.id
     WHERE u.id=?`
  ).bind(token.user_id).first();

  if (!user || user.is_suspended) return err("Account is unavailable", 403);

  await env.DB.prepare(
    "INSERT OR IGNORE INTO verified_emails (user_id) VALUES (?)"
  ).bind(user.id).run();
  await markAuthTokenUsed(env, token.id);

  const session = newId();
  const expires = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
  ).bind(session, user.id, expires).run();

  return json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      isAdmin: Boolean(user.is_admin),
      emailVerified: true
    }
  }, {
    headers: {
      "Set-Cookie": sessionCookie(session, SESSION_SECONDS),
      "Cache-Control": "no-store"
    }
  });
}
